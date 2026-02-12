import { db } from "database";
import { createService } from "lib/service";
import { policy } from "@floyd-run/schema/inputs";

export default createService({
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
