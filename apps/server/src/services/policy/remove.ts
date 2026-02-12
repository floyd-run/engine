import { db } from "database";
import { createService } from "lib/service";
import { policy } from "@floyd-run/schema/inputs";

export default createService({
  input: policy.removeSchema,
  execute: async (input) => {
    const result = await db.deleteFrom("policies").where("id", "=", input.id).executeTakeFirst();

    return { deleted: result.numDeletedRows > 0n };
  },
});
