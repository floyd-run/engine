import { db } from "database";
import { createOperation } from "lib/operation";
import { booking } from "@floyd-run/schema/inputs";

export default createOperation({
  input: booking.getSchema,
  execute: async (input) => {
    const bkg = await db
      .selectFrom("bookings")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    if (!bkg) {
      return { booking: null, allocations: [] };
    }

    const allocations = await db
      .selectFrom("allocations")
      .selectAll()
      .where("bookingId", "=", bkg.id)
      .execute();

    return { booking: bkg, allocations };
  },
});
