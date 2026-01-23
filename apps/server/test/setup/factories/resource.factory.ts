import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createLedger } from "./ledger.factory";

export async function createResource(overrides?: { ledgerId?: string; timezone?: string }) {
  let ledgerId = overrides?.ledgerId;
  if (!ledgerId) {
    const { ledger } = await createLedger();
    ledgerId = ledger.id;
  }

  const resource = await db
    .insertInto("resources")
    .values({
      id: generateId("rsc"),
      ledgerId,
      timezone: overrides?.timezone ?? faker.location.timeZone(),
    })
    .returningAll()
    .executeTakeFirst();

  return { resource: resource!, ledgerId };
}
