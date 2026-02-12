import { db } from "database";
import { createOperation } from "lib/operation";
import { ledgerInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: ledgerInput.get,
  execute: async (input) => {
    const ledger = await db
      .selectFrom("ledgers")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { ledger };
  },
});
