import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { webhook } from "@floyd-run/schema/inputs";
import { randomBytes } from "crypto";

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export default createService({
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
