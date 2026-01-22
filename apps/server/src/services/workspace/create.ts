import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";

export default createService({
  execute: async () => {
    const workspace = await db
      .insertInto("workspaces")
      .values({
        id: generateId("ws"),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { workspace };
  },
});
