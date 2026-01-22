import { db } from "database";
import { createService } from "lib/service";
import { workspace } from "@floyd-run/schema/inputs";

export default createService({
  input: workspace.getSchema,
  execute: async (input) => {
    const workspace = await db
      .selectFrom("workspaces")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { workspace };
  },
});
