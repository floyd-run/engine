import { faker } from "@faker-js/faker";
import { db } from "database";
import { AllocationStatus } from "@floyd-run/schema/types";
import { generateId } from "@floyd-run/utils";
import { createResource } from "./resource.factory";

export async function createAllocation(overrides?: {
  ledgerId?: string;
  resourceId?: string;
  status?: AllocationStatus;
  startAt?: Date;
  endAt?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}) {
  const ledgerIdParam = overrides?.ledgerId;
  let ledgerId: string;
  let resourceId = overrides?.resourceId;

  if (!resourceId) {
    const result = await createResource(ledgerIdParam ? { ledgerId: ledgerIdParam } : {});
    resourceId = result.resource.id;
    ledgerId = result.ledgerId;
  } else if (ledgerIdParam) {
    ledgerId = ledgerIdParam;
  } else {
    const resource = await db
      .selectFrom("resources")
      .where("id", "=", resourceId)
      .selectAll()
      .executeTakeFirstOrThrow();
    ledgerId = resource.ledgerId;
  }

  const startAt = overrides?.startAt ?? faker.date.future();
  const endAt = overrides?.endAt ?? new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour later

  const allocation = await db
    .insertInto("allocations")
    .values({
      id: generateId("alc"),
      ledgerId,
      resourceId,
      status: overrides?.status ?? "confirmed",
      startAt,
      endAt,
      expiresAt: overrides?.expiresAt ?? null,
      metadata: overrides?.metadata ?? null,
    })
    .returningAll()
    .executeTakeFirst();

  return { allocation: allocation!, ledgerId, resourceId };
}
