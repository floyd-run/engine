import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { bookingInput } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeBooking } from "routes/v1/serializers";

export default createOperation({
  input: bookingInput.cancel,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock booking row
      const existing = await trx
        .selectFrom("bookings")
        .selectAll()
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Booking not found");
      }

      // 2. Capture server time
      const serverTime = await getServerTime(trx);

      // 3. Validate state
      if (existing.status === "canceled") {
        // Idempotent — already canceled
        const allocations = await trx
          .selectFrom("allocations")
          .selectAll()
          .where("bookingId", "=", existing.id)
          .execute();
        return { booking: existing, allocations, serverTime };
      }

      if (existing.status !== "hold" && existing.status !== "confirmed") {
        throw new ConflictError("booking.invalid_transition", {
          currentStatus: existing.status,
          requestedStatus: "canceled",
        });
      }

      // 4. Update booking
      const booking = await trx
        .updateTable("bookings")
        .set({
          status: "canceled",
          expiresAt: null,
          updatedAt: serverTime,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Deactivate allocations
      await trx
        .updateTable("allocations")
        .set({ active: false, expiresAt: null, updatedAt: serverTime })
        .where("bookingId", "=", input.id)
        .execute();

      const allocations = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("bookingId", "=", input.id)
        .execute();

      // 6. Enqueue webhook
      await enqueueWebhookEvent(trx, "booking.cancelled", booking.ledgerId, {
        booking: serializeBooking(booking, allocations),
      });

      return { booking, allocations, serverTime };
    });
  },
});
