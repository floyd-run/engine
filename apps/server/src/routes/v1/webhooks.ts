import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeWebhookSubscription, serializeWebhookDelivery } from "./serializers";

// Nested under /v1/ledgers/:ledgerId/webhooks
export const webhooks = new Hono()
  // List subscriptions
  .get("/", async (c) => {
    const { subscriptions } = await services.webhook.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: subscriptions.map(serializeWebhookSubscription) });
  })

  // Create subscription
  .post("/", async (c) => {
    const body = await c.req.json();
    const { subscription } = await services.webhook.create({
      ...body,
      ledgerId: c.req.param("ledgerId")!,
    });

    // Return with secret (only shown once at creation)
    return c.json(
      {
        data: {
          ...serializeWebhookSubscription(subscription),
          secret: subscription.secret,
        },
      },
      201,
    );
  })

  // Get subscription
  .get("/:subscriptionId", async (c) => {
    const { subscription } = await services.webhook.get({
      id: c.req.param("subscriptionId")!,
    });

    if (!subscription) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.json({ data: serializeWebhookSubscription(subscription) });
  })

  // Update subscription
  .patch("/:subscriptionId", async (c) => {
    const body = await c.req.json();
    const { subscription } = await services.webhook.update({
      ...body,
      id: c.req.param("subscriptionId")!,
    });

    if (!subscription) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.json({ data: serializeWebhookSubscription(subscription) });
  })

  // Delete subscription
  .delete("/:subscriptionId", async (c) => {
    const { deleted } = await services.webhook.remove({
      id: c.req.param("subscriptionId")!,
    });

    if (!deleted) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.body(null, 204);
  })

  // Rotate secret
  .post("/:subscriptionId/rotate-secret", async (c) => {
    const { subscription, secret } = await services.webhook.rotateSecret({
      id: c.req.param("subscriptionId")!,
    });

    if (!subscription) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.json({
      data: {
        ...serializeWebhookSubscription(subscription),
        secret,
      },
    });
  })

  // List deliveries for a subscription
  .get("/:subscriptionId/deliveries", async (c) => {
    const { deliveries } = await services.webhook.listDeliveries({
      subscriptionId: c.req.param("subscriptionId")!,
      status: c.req.query("status"),
      limit: c.req.query("limit") as unknown as number | undefined,
    });

    return c.json({ data: deliveries.map(serializeWebhookDelivery) });
  })

  // Retry a failed delivery
  .post("/:subscriptionId/deliveries/:deliveryId/retry", async (c) => {
    const { delivery } = await services.webhook.retryDelivery({
      id: c.req.param("deliveryId")!,
    });

    if (!delivery) {
      throw new NotFoundError("Delivery not found or not in retryable state");
    }

    return c.json({ data: serializeWebhookDelivery(delivery) });
  });
