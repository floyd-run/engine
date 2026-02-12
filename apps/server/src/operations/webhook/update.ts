import { db } from "database";
import { createOperation } from "lib/operation";
import { webhook } from "@floyd-run/schema/inputs";

export default createOperation({
  input: webhook.updateSubscriptionSchema,
  execute: async (input) => {
    const subscription = await db
      .updateTable("webhookSubscriptions")
      .set({
        ...(input.url !== undefined && { url: input.url }),
      })
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .returningAll()
      .executeTakeFirst();

    return { subscription: subscription ?? null };
  },
});
