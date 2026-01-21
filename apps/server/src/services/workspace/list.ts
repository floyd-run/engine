import { db } from "database";
import { createService } from "lib/service";

export default createService({
  execute: async () => {
    const workspaces = await db.selectFrom("workspaces").selectAll().execute();
    return { workspaces };
  },
});
