import { db } from "database";
import { createService } from "lib/service";
import z from "zod";

export default createService({
  execute: async () => {
    const resources = await db.selectFrom("resources").selectAll().execute();
    return { resources };
  },
});
