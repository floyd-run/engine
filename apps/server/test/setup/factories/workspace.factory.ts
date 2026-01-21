import { faker } from "@faker-js/faker";
import { db } from "database";

export async function createWorkspace(overrides?: { workspaceId?: string; description?: string | null }) {
  const workspace = await db
    .insertInto("workspaces")
    .values({
      workspaceId: overrides?.workspaceId ?? faker.string.alphanumeric(10),
      description: overrides?.description ?? faker.lorem.sentence(),
    })
    .returningAll()
    .executeTakeFirst();

  return { workspace: workspace! };
}
