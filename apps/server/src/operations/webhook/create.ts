import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { webhook } from "@floyd-run/schema/inputs";
import { generateSecret } from "./generate-secret";

export default createOperation({
  input: webhook.createSubscriptionSchema,
  execute: async (input) => {
    const subscription = await db
      .insertInto("webhookSubscriptions")
      .values({
        id: generateId("whs"),
        ledgerId: input.ledgerId,
        url: input.url,
        secret: generateSecret(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { subscription };
  },
});
