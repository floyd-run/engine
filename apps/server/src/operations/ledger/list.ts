import { db } from "database";
import { createOperation } from "lib/operation";

export default createOperation({
  execute: async () => {
    const ledgers = await db.selectFrom("ledgers").selectAll().execute();
    return { ledgers };
  },
});
