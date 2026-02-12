import { db } from "database";
import { createOperation } from "lib/operation";
import { webhook } from "@floyd-run/schema/inputs";

export default createOperation({
  input: webhook.deleteSubscriptionSchema,
  execute: async (input) => {
    const result = await db
      .deleteFrom("webhookSubscriptions")
      .where("id", "=", input.id)
      .executeTakeFirst();

    return { deleted: result.numDeletedRows > 0n };
  },
});
