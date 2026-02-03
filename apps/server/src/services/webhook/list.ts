import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";

export default createService({
  input: webhook.listSubscriptionsSchema,
  execute: async (input) => {
    const subscriptions = await db
      .selectFrom("webhookSubscriptions")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .orderBy("createdAt", "desc")
      .execute();

    return { subscriptions };
  },
});
