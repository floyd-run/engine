import { db } from "database";
import { createOperation } from "lib/operation";
import { webhook } from "@floyd-run/schema/inputs";

export default createOperation({
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
