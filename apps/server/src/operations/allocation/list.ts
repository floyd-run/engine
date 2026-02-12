import { db } from "database";
import { createOperation } from "lib/operation";
import { allocation } from "@floyd-run/schema/inputs";

export default createOperation({
  input: allocation.listSchema,
  execute: async (input) => {
    const allocations = await db
      .selectFrom("allocations")
      .where("ledgerId", "=", input.ledgerId)
      .selectAll()
      .execute();
    return { allocations };
  },
});
