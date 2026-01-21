import { db } from "database";
import z from "zod";
import { createService } from "lib/service";

export default createService({
  input: z.object({
    workspaceId: z.string().min(1).max(255),
    description: z.string().nullish(),
  }),
  execute: async (input) => {
    const workspace = await db
      .insertInto("workspaces")
      .values({
        workspaceId: input.workspaceId,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { workspace };
  },
});
