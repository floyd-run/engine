import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";

export default createService({
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
