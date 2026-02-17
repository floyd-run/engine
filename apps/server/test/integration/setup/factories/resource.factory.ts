import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createLedger } from "./ledger.factory";

export async function createResource(overrides?: {
  ledgerId?: string;
  name?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
}) {
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
      name: overrides?.name ?? "Test Resource",
      timezone: overrides?.timezone ?? "UTC",
      metadata: overrides?.metadata ?? {},
    })
    .returningAll()
    .executeTakeFirst();

  return { resource: resource!, ledgerId };
}
