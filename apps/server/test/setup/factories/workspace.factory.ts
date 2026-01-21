import { db } from "database";
import { generateId } from "lib/id";

export async function createWorkspace() {
  const workspace = await db
    .insertInto("workspaces")
    .values({
      id: generateId("ws"),
    })
    .returningAll()
    .executeTakeFirst();

  return { workspace: workspace! };
}
