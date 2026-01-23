import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeWebhookSubscription } from "./serializers";

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
  });
