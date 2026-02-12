import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { booking } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeBooking } from "routes/v1/serializers";

export default createOperation({
  input: booking.confirmSchema,
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
      if (existing.status === "confirmed") {
        // Idempotent — already confirmed
        const allocations = await trx
          .selectFrom("allocations")
          .selectAll()
          .where("bookingId", "=", existing.id)
          .execute();
        return { booking: existing, allocations, serverTime };
      }

      if (existing.status !== "hold") {
        throw new ConflictError("invalid_state_transition", {
          currentStatus: existing.status,
          requestedStatus: "confirmed",
        });
      }

      // 4. Check if hold has expired
      if (existing.expiresAt && serverTime >= existing.expiresAt) {
        throw new ConflictError("hold_expired", {
          expiresAt: existing.expiresAt,
          serverTime,
        });
      }

      // 5. Update booking
      const bkg = await trx
        .updateTable("bookings")
        .set({
          status: "confirmed",
          expiresAt: null,
          updatedAt: serverTime,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 6. Update allocations
      await trx
        .updateTable("allocations")
        .set({ expiresAt: null, updatedAt: serverTime })
        .where("bookingId", "=", input.id)
        .execute();

      const allocations = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("bookingId", "=", input.id)
        .execute();

      // 7. Enqueue webhook
      await enqueueWebhookEvent(trx, "booking.confirmed", bkg.ledgerId, {
        booking: serializeBooking(bkg, allocations),
      });

      return { booking: bkg, allocations, serverTime };
    });
  },
});
