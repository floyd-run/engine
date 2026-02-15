import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";

export default createOperation({
  execute: async () => {
    const ledger = await db
      .insertInto("ledgers")
      .values({
        id: generateId("ldg"),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ledger };
  },
});
