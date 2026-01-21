import { faker } from "@faker-js/faker";
import { db } from "database";
import { AllocationStatus } from "database/schema";
import { generateId } from "lib/id";
import { createResource } from "./resource.factory";

export async function createAllocation(overrides?: {
  workspaceId?: string;
  resourceId?: string;
  status?: AllocationStatus;
  startAt?: Date;
  endAt?: Date;
  expiresAt?: Date | null;
  version?: number;
  metadata?: Record<string, unknown> | null;
}) {
  let workspaceId = overrides?.workspaceId;
  let resourceId = overrides?.resourceId;

  if (!resourceId) {
    const result = await createResource({ workspaceId });
    resourceId = result.resource.id;
    workspaceId = result.workspaceId;
  }

  if (!workspaceId) {
    const resource = await db
      .selectFrom("resources")
      .where("id", "=", resourceId)
      .selectAll()
      .executeTakeFirstOrThrow();
    workspaceId = resource.workspaceId;
  }

  const startAt = overrides?.startAt ?? faker.date.future();
  const endAt = overrides?.endAt ?? new Date(startAt.getTime() + 60 * 60 * 1000); // 1 hour later

  const allocation = await db
    .insertInto("allocations")
    .values({
      id: generateId("alloc"),
      workspaceId,
      resourceId,
      status: overrides?.status ?? "CONFIRMED",
      startAt,
      endAt,
      expiresAt: overrides?.expiresAt ?? null,
      version: overrides?.version ?? 1,
      metadata: overrides?.metadata ?? null,
    })
    .returningAll()
    .executeTakeFirst();

  return { allocation: allocation!, workspaceId, resourceId };
}
