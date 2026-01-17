import { db } from "database";
import { createService } from "lib/service";
import z from "zod";

export default createService({
  input: z.object({
    id: z.uuid(),
  }),
  execute: async (input) => {
    await db.deleteFrom("resources").where("id", "=", input.id).executeTakeFirstOrThrow();
  },
});
