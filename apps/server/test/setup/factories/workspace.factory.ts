import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "lib/id";

export async function createWorkspace(overrides?: { description?: string | null }) {
  const workspace = await db
    .insertInto("workspaces")
    .values({
      id: generateId("ws"),
      description: overrides?.description ?? faker.lorem.sentence(),
    })
    .returningAll()
    .executeTakeFirst();

  return { workspace: workspace! };
}
