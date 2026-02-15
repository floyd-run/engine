import { db } from "database";
import { createOperation } from "lib/operation";
import { bookingInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: bookingInput.get,
  execute: async (input) => {
    const booking = await db
      .selectFrom("bookings")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    if (!booking) {
      return { booking: null, allocations: [] };
    }

    const allocations = await db
      .selectFrom("allocations")
      .selectAll()
      .where("bookingId", "=", booking.id)
      .execute();

    return { booking, allocations };
  },
});
