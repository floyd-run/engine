import { db } from "database";
import { createOperation } from "lib/operation";
import { allocation } from "@floyd-run/schema/inputs";

export default createOperation({
  input: allocation.getSchema,
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
