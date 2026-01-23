import { db } from "database";
import { createService } from "lib/service";
import { webhook } from "@floyd-run/schema/inputs";
import type { WebhookDeliveryStatus } from "@floyd-run/schema/types";

export default createService({
  input: webhook.listDeliveriesSchema,
  execute: async (input) => {
    let query = db
      .selectFrom("webhookDeliveries")
      .selectAll()
      .where("subscriptionId", "=", input.subscriptionId)
      .orderBy("createdAt", "desc")
      .limit(input.limit);

    if (input.status) {
      query = query.where("status", "=", input.status as WebhookDeliveryStatus);
    }

    const deliveries = await query.execute();

    return { deliveries };
  },
});
