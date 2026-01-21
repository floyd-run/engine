import { db } from "database";
import { createService } from "lib/service";
import z from "zod";

export default createService({
  input: z.object({
    workspaceId: z.string(),
  }),
  execute: async (input) => {
    const workspace = await db
      .selectFrom("workspaces")
      .where("workspaceId", "=", input.workspaceId)
      .selectAll()
      .executeTakeFirst();

    return { workspace };
  },
});
