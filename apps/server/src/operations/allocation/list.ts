import { db } from "database";
import { createOperation } from "lib/operation";
import { allocationInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: allocationInput.list,
  execute: async (input) => {
    const allocations = await db
      .selectFrom("allocations")
      .where("ledgerId", "=", input.ledgerId)
      .selectAll()
      .execute();
    return { allocations };
  },
});
