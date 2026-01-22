import { db } from "database";
import { createService } from "lib/service";
import { allocation } from "@floyd-run/schema/inputs";

export default createService({
  input: allocation.getSchema,
  execute: async (input) => {
    const allocation = await db
      .selectFrom("allocations")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { allocation };
  },
});
