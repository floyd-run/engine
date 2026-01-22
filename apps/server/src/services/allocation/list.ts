import { db } from "database";
import { createService } from "lib/service";
import { allocation } from "@floyd-run/schema/inputs";

export default createService({
  input: allocation.listSchema,
  execute: async (input) => {
    const allocations = await db
      .selectFrom("allocations")
      .where("workspaceId", "=", input.workspaceId)
      .selectAll()
      .execute();
    return { allocations };
  },
});
