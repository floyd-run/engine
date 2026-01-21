import { db } from "database";
import { createService } from "lib/service";
import { isValidId } from "lib/id";
import z from "zod";

export default createService({
  input: z.object({
    workspaceId: z
      .string()
      .refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
  }),
  execute: async (input) => {
    const allocations = await db
      .selectFrom("allocations")
      .where("workspaceId", "=", input.workspaceId)
      .selectAll()
      .execute();
    return { allocations };
  },
});
