import { db } from "database";
import { sql } from "kysely";
import { logger } from "infra/logger";
import { enqueueWebhookEvent } from "infra/webhooks";

const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 100;

let isRunning = false;

async function processExpiredHolds(): Promise<number> {
  return await db.transaction().execute(async (trx) => {
    // Get server time
    const result = await sql<{
      serverTime: Date;
    }>`SELECT clock_timestamp() AS server_time`.execute(trx);
    const serverTime = result.rows[0]!.serverTime;

    // Find expired holds and lock them
    const expiredHolds = await trx
      .selectFrom("allocations")
      .selectAll()
      .where("status", "=", "hold")
      .where("expiresAt", "<=", serverTime)
      .limit(BATCH_SIZE)
      .forUpdate()
      .skipLocked()
      .execute();

    if (expiredHolds.length === 0) {
      return 0;
    }

    const ids = expiredHolds.map((h) => h.id);

    // Update to expired (clear expiresAt per database constraint)
    await trx
      .updateTable("allocations")
      .set({
        status: "expired",
        expiresAt: null,
        updatedAt: serverTime,
      })
      .where("id", "in", ids)
      .execute();

    // Enqueue webhook events for each expired allocation
    for (const hold of expiredHolds) {
      await enqueueWebhookEvent(trx, "allocation.expired", hold.ledgerId, {
        ...hold,
        status: "expired",
        expiresAt: null,
        updatedAt: serverTime,
      });
    }

    return expiredHolds.length;
  });
}

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  logger.info("[expiration-worker] Starting hold expiration worker...");

  while (isRunning) {
    try {
      const processed = await processExpiredHolds();
      if (processed > 0) {
        logger.info(`[expiration-worker] Expired ${processed} holds`);
      }
    } catch (error) {
      logger.error(error, "[expiration-worker] Error processing expirations");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function stopExpirationWorker(): void {
  logger.info("[expiration-worker] Stopping hold expiration worker...");
  isRunning = false;
}

export function startExpirationWorker(): void {
  runWorker().catch((error) => {
    logger.error(error, "[expiration-worker] Fatal error");
  });
}
