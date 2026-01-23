import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";

export default createService({
  input: webhook.getSubscriptionSchema,
  execute: async (input) => {
    const subscription = await db
      .selectFrom("webhookSubscriptions")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    return { subscription: subscription ?? null };
  },
});
