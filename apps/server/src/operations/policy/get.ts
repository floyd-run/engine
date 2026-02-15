import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policyInput.get,
  execute: async (input) => {
    const row = await db
      .selectFrom("policies")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    return { policy: row ?? null };
  },
});
