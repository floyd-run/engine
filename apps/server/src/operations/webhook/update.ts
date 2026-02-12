import { db } from "database";
import { createOperation } from "lib/operation";
import { webhookInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: webhookInput.updateSubscription,
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
