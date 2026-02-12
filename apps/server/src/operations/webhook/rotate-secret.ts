import { db } from "database";
import { createOperation } from "lib/operation";
import { webhook } from "@floyd-run/schema/inputs";
import { generateSecret } from "./generate-secret";

export default createOperation({
  input: webhook.rotateSecretSchema,
  execute: async (input) => {
    const newSecret = generateSecret();

    const subscription = await db
      .updateTable("webhookSubscriptions")
      .set({ secret: newSecret })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirst();

    return { subscription: subscription ?? null, secret: newSecret };
  },
});
