import { db } from "database";
import { createService } from "lib/service";
import { isValidId } from "lib/id";
import z from "zod";

export default createService({
  input: z.object({
    id: z.string().refine((id) => isValidId(id, "alloc"), { message: "Invalid allocation ID" }),
  }),
  execute: async (input) => {
    const allocation = await db
      .selectFrom("allocations")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { allocation };
  },
});
