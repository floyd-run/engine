import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createLedger } from "./ledger.factory";

export async function createService(overrides?: {
  ledgerId?: string;
  name?: string;
  policyId?: string | null;
  resourceIds?: string[];
  metadata?: Record<string, unknown>;
}) {
  let ledgerId = overrides?.ledgerId;
  if (!ledgerId) {
    const { ledger } = await createLedger();
    ledgerId = ledger.id;
  }

  const service = await db
    .insertInto("services")
    .values({
      id: generateId("svc"),
      ledgerId,
      name: overrides?.name ?? "Test Service",
      policyId: overrides?.policyId ?? null,
      metadata: overrides?.metadata ?? {},
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const resourceIds = overrides?.resourceIds ?? [];
  if (resourceIds.length > 0) {
    await db
      .insertInto("serviceResources")
      .values(resourceIds.map((resourceId) => ({ serviceId: service.id, resourceId })))
      .execute();
  }

  return { service, ledgerId, resourceIds };
}
