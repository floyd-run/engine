import { db } from "database";
import { createOperation } from "lib/operation";
import { policy } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policy.listSchema,
  execute: async (input) => {
    const policies = await db
      .selectFrom("policies")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    return { policies };
  },
});
