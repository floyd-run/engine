import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "lib/id";
import { createWorkspace } from "./workspace.factory";

export async function createResource(overrides?: { workspaceId?: string; timezone?: string }) {
  let workspaceId = overrides?.workspaceId;
  if (!workspaceId) {
    const { workspace } = await createWorkspace();
    workspaceId = workspace.id;
  }

  const resource = await db
    .insertInto("resources")
    .values({
      id: generateId("res"),
      workspaceId,
      timezone: overrides?.timezone ?? faker.location.timeZone(),
    })
    .returningAll()
    .executeTakeFirst();

  return { resource: resource!, workspaceId };
}
