import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";

export default createService({
  input: webhook.deleteSubscriptionSchema,
  execute: async (input) => {
    const result = await db
      .deleteFrom("webhookSubscriptions")
      .where("id", "=", input.id)
      .executeTakeFirst();

    return { deleted: result.numDeletedRows > 0n };
  },
});
