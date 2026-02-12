import { db } from "database";
import { createOperation } from "lib/operation";
import { policy } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policy.getSchema,
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
