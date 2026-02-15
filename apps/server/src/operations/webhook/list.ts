import { db } from "database";
import { createOperation } from "lib/operation";
import { webhookInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: webhookInput.listSubscriptions,
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
