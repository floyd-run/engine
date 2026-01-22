import { faker } from "@faker-js/faker";
import { db } from "database";
import { AllocationStatus } from "@floyd-run/schema/types";
import { generateId } from "@floyd-run/utils";
import { createResource } from "./resource.factory";

export async function createAllocation(overrides?: {
  workspaceId?: string;
  resourceId?: string;
  status?: AllocationStatus;
  startAt?: Date;
  endAt?: Date;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}) {
  const workspaceIdParam = overrides?.workspaceId;
  let workspaceId: string;
  let resourceId = overrides?.resourceId;

  if (!resourceId) {
    const result = await createResource(workspaceIdParam ? { workspaceId: workspaceIdParam } : {});
    resourceId = result.resource.id;
    workspaceId = result.workspaceId;
  } else if (workspaceIdParam) {
    workspaceId = workspaceIdParam;
  } else {
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
      status: overrides?.status ?? "confirmed",
      startAt,
      endAt,
      expiresAt: overrides?.expiresAt ?? null,
      metadata: overrides?.metadata ?? null,
    })
    .returningAll()
    .executeTakeFirst();

  return { allocation: allocation!, workspaceId, resourceId };
}
