import { db } from "database";
import z from "zod";
import { createService } from "lib/service";
import { generateId } from "lib/id";

export default createService({
  input: z.object({
    description: z.string().nullish(),
  }),
  execute: async (input) => {
    const workspace = await db
      .insertInto("workspaces")
      .values({
        id: generateId("ws"),
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { workspace };
  },
});
