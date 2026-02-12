import { db } from "database";
import { createOperation } from "lib/operation";
import { booking } from "@floyd-run/schema/inputs";
import type { AllocationRow } from "database/schema";

export default createOperation({
  input: booking.listSchema,
  execute: async (input) => {
    const bookings = await db
      .selectFrom("bookings")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    // Batch load allocations for all bookings
    const allocationsByBooking = new Map<string, AllocationRow[]>();
    for (const bkg of bookings) {
      allocationsByBooking.set(bkg.id, []);
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

      for (const alloc of allocations) {
        if (alloc.bookingId) {
          const list = allocationsByBooking.get(alloc.bookingId);
          if (list) {
            list.push(alloc);
          }
        }
      }
    }

    return {
      bookings: bookings.map((bkg) => ({
        booking: bkg,
        allocations: allocationsByBooking.get(bkg.id) || [],
      })),
    };
  },
});
