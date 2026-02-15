import { db } from "database";
import { createOperation } from "lib/operation";
import { allocationInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: allocationInput.get,
  execute: async (input) => {
    const allocation = await db
      .selectFrom("allocations")
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .selectAll()
      .executeTakeFirst();

    return { allocation };
  },
});
