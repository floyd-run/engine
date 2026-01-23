import { z } from "./zod";
import { WebhookDeliveryStatus } from "../constants";

export const subscriptionSchema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  url: z.string(),
  eventTypes: z.array(z.string()).nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subscriptionWithSecretSchema = subscriptionSchema.extend({
  secret: z.string(),
});

export const deliverySchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  eventType: z.string(),
  status: z.enum(WebhookDeliveryStatus),
  attempts: z.number(),
  maxAttempts: z.number(),
  nextAttemptAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastStatusCode: z.number().nullable(),
  createdAt: z.string(),
});

export const getSubscriptionSchema = z.object({
  data: subscriptionSchema,
});

export const createSubscriptionSchema = z.object({
  data: subscriptionWithSecretSchema,
});

export const listSubscriptionsSchema = z.object({
  data: z.array(subscriptionSchema),
});

export const rotateSecretSchema = z.object({
  data: subscriptionWithSecretSchema,
});

export const listDeliveriesSchema = z.object({
  data: z.array(deliverySchema),
});

export const retryDeliverySchema = z.object({
  data: deliverySchema,
});
