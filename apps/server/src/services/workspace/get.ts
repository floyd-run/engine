import { db } from "database";
import { createService } from "lib/service";
import { isValidId } from "lib/id";
import z from "zod";

export default createService({
  input: z.object({
    id: z.string().refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
  }),
  execute: async (input) => {
    const workspace = await db
      .selectFrom("workspaces")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { workspace };
  },
});
