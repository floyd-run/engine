import { db } from "database";
import z from "zod";
import { createService } from "lib/service";
import { generateId, isValidId } from "lib/id";

export default createService({
  input: z.object({
    workspaceId: z
      .string()
      .refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
    timezone: z.string().default("UTC"),
  }),
  execute: async (input) => {
    const resource = await db
      .insertInto("resources")
      .values({
        id: generateId("res"),
        workspaceId: input.workspaceId,
        timezone: input.timezone,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { resource };
  },
});
