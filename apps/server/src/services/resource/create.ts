import { db } from "database";
import z from "zod";
import { createService } from "lib/service";
import { generateId } from "lib/id";

export default createService({
  input: z.object({
    name: z.string(),
    timezone: z.string(),
    metadata: z.record(z.string(), z.any()),
  }),
  execute: async (input) => {
    const resource = await db
      .insertInto("resources")
      .values({
        id: generateId("res"),
        name: input.name,
        timezone: input.timezone,
        metadata: input.metadata,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { resource };
  },
});
