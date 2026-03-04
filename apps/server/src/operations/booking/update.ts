import { db } from "database";
import { createOperation } from "lib/operation";
import { bookingInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";

export default createOperation({
  input: bookingInput.update,
  execute: async (input) => {
    const booking = await db
      .updateTable("bookings")
      .set({
        metadata: input.metadata,
      })
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .returningAll()
      .executeTakeFirst();

    if (!booking) {
      throw new NotFoundError("Booking not found");
    }

    const allocations = await db
      .selectFrom("allocations")
      .selectAll()
      .where("bookingId", "=", booking.id)
      .execute();

    return { booking, allocations };
  },
});
