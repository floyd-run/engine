import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";
import { generateSecret } from "./generate-secret";

export default createService({
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
