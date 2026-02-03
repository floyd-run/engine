import { db } from "database";
import { generateId } from "@floyd-run/utils";

export async function createLedger() {
  const ledger = await db
    .insertInto("ledgers")
    .values({
      id: generateId("ldg"),
    })
    .returningAll()
    .executeTakeFirst();

  return { ledger: ledger! };
}
