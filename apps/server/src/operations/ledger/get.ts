import { db } from "database";
import { createOperation } from "lib/operation";
import { ledger } from "@floyd-run/schema/inputs";

export default createOperation({
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
