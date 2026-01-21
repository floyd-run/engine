import { db } from "database";
import { createService } from "lib/service";
import { isValidId } from "lib/id";
import z from "zod";

export default createService({
  input: z.object({
    id: z.string().refine((id) => isValidId(id, "res"), { message: "Invalid resource ID" }),
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
