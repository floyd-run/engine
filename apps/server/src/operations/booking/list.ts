import { db } from "database";
import { createOperation } from "lib/operation";
import { bookingInput } from "@floyd-run/schema/inputs";
import type { AllocationRow } from "database/schema";

export default createOperation({
  input: bookingInput.list,
  execute: async (input) => {
    const bookings = await db
      .selectFrom("bookings")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    // Batch load allocations for all bookings
    const allocationsByBooking = new Map<string, AllocationRow[]>();
    for (const booking of bookings) {
      allocationsByBooking.set(booking.id, []);
    }

    if (bookings.length > 0) {
      const allocations = await db
        .selectFrom("allocations")
        .selectAll()
        .where(
          "bookingId",
          "in",
          bookings.map((b) => b.id),
        )
        .execute();

      for (const allocation of allocations) {
        if (allocation.bookingId) {
          const list = allocationsByBooking.get(allocation.bookingId);
          if (list) {
            list.push(allocation);
          }
        }
      }
    }

    return {
      bookings: bookings.map((booking) => ({
        booking,
        allocations: allocationsByBooking.get(booking.id) ?? [],
      })),
    };
  },
});
