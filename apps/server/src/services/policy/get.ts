import { db } from "database";
import { createService } from "lib/service";
import { policy } from "@floyd-run/schema/inputs";

export default createService({
  input: policy.getSchema,
  execute: async (input) => {
    const row = await db
      .selectFrom("policies")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    return { policy: row ?? null };
  },
});
