import { db } from "database";
import { createService } from "lib/service";
import z from "zod";

export default createService({
  input: z.object({
    id: z.uuid(),
  }),
  execute: async (input) => {
    const resource = await db
      .selectFrom("resources")
      .where("id", "=", input.id)
      .selectAll()
      .execute();

    return { resource: resource[0] };
  },
});
