import { db } from "database";
import { createOperation } from "lib/operation";
import { serviceInput } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";

export default createOperation({
  input: serviceInput.remove,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Verify service exists
      const existing = await trx
        .selectFrom("services")
        .select("id")
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Service not found");
      }

      // 2. Check for active bookings
      const activeBooking = await trx
        .selectFrom("bookings")
        .select("id")
        .where("serviceId", "=", input.id)
        .where("status", "in", ["hold", "confirmed"])
        .limit(1)
        .executeTakeFirst();

      if (activeBooking) {
        throw new ConflictError("resource.active_bookings");
      }

      // 3. Clean up non-active bookings (canceled/expired) and their allocations
      const staleBookings = await trx
        .selectFrom("bookings")
        .select("id")
        .where("serviceId", "=", input.id)
        .execute();

      if (staleBookings.length > 0) {
        const bookingIds = staleBookings.map((b) => b.id);
        await trx.deleteFrom("allocations").where("bookingId", "in", bookingIds).execute();
        await trx.deleteFrom("bookings").where("id", "in", bookingIds).execute();
      }

      // 4. Delete service (CASCADE handles service_resources)
      await trx.deleteFrom("services").where("id", "=", input.id).execute();

      return { deleted: true };
    });
  },
});
