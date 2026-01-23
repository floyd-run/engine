import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";

export default createService({
  input: webhook.updateSubscriptionSchema,
  execute: async (input) => {
    const subscription = await db
      .updateTable("webhookSubscriptions")
      .set({
        ...(input.url !== undefined && { url: input.url }),
        ...(input.eventTypes !== undefined && { eventTypes: input.eventTypes }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
      })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirst();

    return { subscription: subscription ?? null };
  },
});
