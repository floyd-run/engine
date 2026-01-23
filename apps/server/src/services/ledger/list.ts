import { db } from "database";
import { createService } from "lib/service";

export default createService({
  execute: async () => {
    const ledgers = await db.selectFrom("ledgers").selectAll().execute();
    return { ledgers };
  },
});
