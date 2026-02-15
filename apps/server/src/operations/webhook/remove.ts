import { db } from "database";
import { createOperation } from "lib/operation";
import { webhookInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: webhookInput.deleteSubscription,
  execute: async (input) => {
    const result = await db
      .deleteFrom("webhookSubscriptions")
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    return { deleted: result.numDeletedRows > 0n };
  },
});
