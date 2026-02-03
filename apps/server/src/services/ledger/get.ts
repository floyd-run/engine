import { db } from "database";
import { createService } from "lib/service";
import { ledger } from "@floyd-run/schema/inputs";

export default createService({
  input: ledger.getSchema,
  execute: async (input) => {
    const ledger = await db
      .selectFrom("ledgers")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { ledger };
  },
});
