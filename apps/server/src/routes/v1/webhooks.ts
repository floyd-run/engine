/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Hono } from "hono";
import { operations } from "operations";
import { NotFoundError } from "lib/errors";
import { serializeWebhookSubscription } from "./serializers";

// Nested under /v1/ledgers/:ledgerId/webhooks
export const webhooks = new Hono()
  // List subscriptions
  .get("/", async (c) => {
    const { subscriptions } = await operations.webhook.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: subscriptions.map(serializeWebhookSubscription) });
  })

  // Create subscription
  .post("/", async (c) => {
    const body = await c.req.json();
    const { subscription } = await operations.webhook.create({
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
  .patch("/:id", async (c) => {
    const body = await c.req.json();
    const { subscription } = await operations.webhook.update({
      ...body,
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
    });

    if (!subscription) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.json({ data: serializeWebhookSubscription(subscription) });
  })

  // Delete subscription
  .delete("/:id", async (c) => {
    const { deleted } = await operations.webhook.remove({
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
    });

    if (!deleted) {
      throw new NotFoundError("Webhook subscription not found");
    }

    return c.body(null, 204);
  })

  // Rotate secret
  .post("/:id/rotate-secret", async (c) => {
    const { subscription, secret } = await operations.webhook.rotateSecret({
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
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
