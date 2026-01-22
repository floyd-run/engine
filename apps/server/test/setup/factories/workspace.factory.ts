import { db } from "database";
import { generateId } from "@floyd-run/utils";

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
