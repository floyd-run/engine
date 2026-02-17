import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createResource } from "./resource.factory";

export async function createAllocation(overrides?: {
  ledgerId?: string;
  resourceId?: string;
  active?: boolean;
  bookingId?: string | null;
  startTime?: Date;
  endTime?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
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

  const startTime = overrides?.startTime ?? faker.date.future();
  const endTime = overrides?.endTime ?? new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour later

  const allocation = await db
    .insertInto("allocations")
    .values({
      id: generateId("alc"),
      ledgerId,
      resourceId,
      bookingId: overrides?.bookingId ?? null,
      active: overrides?.active ?? true,
      startTime,
      endTime,
      bufferBeforeMs: 0,
      bufferAfterMs: 0,
      expiresAt: overrides?.expiresAt ?? null,
      metadata: overrides?.metadata ?? {},
    })
    .returningAll()
    .executeTakeFirst();

  return { allocation: allocation!, ledgerId, resourceId };
}
