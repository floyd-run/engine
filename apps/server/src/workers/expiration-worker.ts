import { db, getServerTime } from "database";
import { logger } from "infra/logger";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeBooking } from "routes/v1/serializers";

const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 100;

let isRunning = false;

async function processExpiredBookings(): Promise<number> {
  return await db.transaction().execute(async (trx) => {
    const serverTime = await getServerTime(trx);

    // Find expired booking holds and lock them
    const expiredBookings = await trx
      .selectFrom("bookings")
      .selectAll()
      .where("status", "=", "hold")
      .where("expiresAt", "<=", serverTime)
      .limit(BATCH_SIZE)
      .forUpdate()
      .skipLocked()
      .execute();

    if (expiredBookings.length === 0) {
      return 0;
    }

    const ids = expiredBookings.map((b) => b.id);

    // Update bookings to expired
    await trx
      .updateTable("bookings")
      .set({
        status: "expired",
        expiresAt: null,
        updatedAt: serverTime,
      })
      .where("id", "in", ids)
      .execute();

    // Deactivate associated allocations
    await trx
      .updateTable("allocations")
      .set({
        active: false,
        expiresAt: null,
        updatedAt: serverTime,
      })
      .where("bookingId", "in", ids)
      .execute();

    // Enqueue webhook events
    for (const booking of expiredBookings) {
      const allocations = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("bookingId", "=", booking.id)
        .execute();

      const expiredBooking = {
        ...booking,
        status: "expired" as const,
        expiresAt: null,
        updatedAt: serverTime,
      };
      await enqueueWebhookEvent(trx, "booking.expired", booking.ledgerId, {
        booking: serializeBooking(expiredBooking, allocations),
      });
    }

    return expiredBookings.length;
  });
}

async function cleanupExpiredRawAllocations(): Promise<number> {
  return await db.transaction().execute(async (trx) => {
    const serverTime = await getServerTime(trx);

    // Find expired raw allocations (no booking) and hard delete
    const expired = await trx
      .selectFrom("allocations")
      .select("id")
      .where("bookingId", "is", null)
      .where("expiresAt", "is not", null)
      .where("expiresAt", "<=", serverTime)
      .limit(BATCH_SIZE)
      .forUpdate()
      .skipLocked()
      .execute();

    if (expired.length === 0) {
      return 0;
    }

    const ids = expired.map((a) => a.id);
    await trx.deleteFrom("allocations").where("id", "in", ids).execute();

    return expired.length;
  });
}

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  logger.info("[expiration-worker] Starting expiration worker...");

  while (isRunning) {
    try {
      const expiredBookings = await processExpiredBookings();
      if (expiredBookings > 0) {
        logger.info(`[expiration-worker] Expired ${expiredBookings} booking holds`);
      }

      const cleanedAllocations = await cleanupExpiredRawAllocations();
      if (cleanedAllocations > 0) {
        logger.info(`[expiration-worker] Cleaned up ${cleanedAllocations} expired raw allocations`);
      }
    } catch (error) {
      logger.error(error, "[expiration-worker] Error processing expirations");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function stopExpirationWorker(): void {
  logger.info("[expiration-worker] Stopping expiration worker...");
  isRunning = false;
}

export function startExpirationWorker(): void {
  runWorker().catch((error) => {
    logger.error(error, "[expiration-worker] Fatal error");
  });
}
