import { db, getServerTime } from "database";
import { logger } from "infra/logger";
import { emitEvent } from "infra/event-bus";
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

    const bookingIds = expiredBookings.map((booking) => booking.id);

    // Update bookings to expired
    await trx
      .updateTable("bookings")
      .set({
        status: "expired",
        expiresAt: null,
        updatedAt: serverTime,
      })
      .where("id", "in", bookingIds)
      .execute();

    // Deactivate associated allocations
    await trx
      .updateTable("allocations")
      .set({
        active: false,
        expiresAt: null,
        updatedAt: serverTime,
      })
      .where("bookingId", "in", bookingIds)
      .execute();

    // Fetch all allocations for expired bookings in one query
    const allocations = await trx
      .selectFrom("allocations")
      .selectAll()
      .where("bookingId", "in", bookingIds)
      .execute();

    const allocationsByBookingId = new Map<string, typeof allocations>();
    for (const allocation of allocations) {
      const group = allocationsByBookingId.get(allocation.bookingId!) ?? [];
      group.push(allocation);
      allocationsByBookingId.set(allocation.bookingId!, group);
    }

    // Emit events to outbox
    for (const booking of expiredBookings) {
      await emitEvent(trx, "booking.expired", booking.ledgerId, {
        booking: serializeBooking(
          { ...booking, status: "expired" as const, expiresAt: null, updatedAt: serverTime },
          allocationsByBookingId.get(booking.id) ?? [],
        ),
      });
    }

    return expiredBookings.length;
  });
}

async function cleanupExpiredRawAllocations(): Promise<number> {
  return await db.transaction().execute(async (trx) => {
    const serverTime = await getServerTime(trx);

    // Find expired raw allocations (no booking) and hard delete
    const expiredAllocations = await trx
      .selectFrom("allocations")
      .select("id")
      .where("bookingId", "is", null)
      .where("expiresAt", "is not", null)
      .where("expiresAt", "<=", serverTime)
      .limit(BATCH_SIZE)
      .forUpdate()
      .skipLocked()
      .execute();

    if (expiredAllocations.length === 0) {
      return 0;
    }

    const allocationIds = expiredAllocations.map((allocation) => allocation.id);
    await trx.deleteFrom("allocations").where("id", "in", allocationIds).execute();

    return expiredAllocations.length;
  });
}

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  logger.info("[expiration-worker] Starting expiration worker...");

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (isRunning) {
    try {
      const expiredCount = await processExpiredBookings();
      if (expiredCount > 0) {
        logger.info(`[expiration-worker] Expired ${expiredCount} booking holds`);
      }

      const cleanedCount = await cleanupExpiredRawAllocations();
      if (cleanedCount > 0) {
        logger.info(`[expiration-worker] Cleaned up ${cleanedCount} expired raw allocations`);
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
  runWorker().catch((error: unknown) => {
    logger.error(error, "[expiration-worker] Fatal error");
  });
}
