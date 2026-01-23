import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";

export default createService({
  input: webhook.retryDeliverySchema,
  execute: async (input) => {
    const delivery = await db
      .updateTable("webhookDeliveries")
      .set({
        status: "pending",
        nextAttemptAt: new Date(),
      })
      .where("id", "=", input.id)
      .where("status", "in", ["failed", "exhausted"])
      .returningAll()
      .executeTakeFirst();

    return { delivery: delivery ?? null };
  },
});
