import { z } from "./zod";

export const subscriptionSchema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subscriptionWithSecretSchema = subscriptionSchema.extend({
  secret: z.string(),
});

export const createSubscriptionSchema = z.object({
  data: subscriptionWithSecretSchema,
});

export const listSubscriptionsSchema = z.object({
  data: z.array(subscriptionSchema),
});

export const updateSubscriptionSchema = z.object({
  data: subscriptionSchema,
});

export const rotateSecretSchema = z.object({
  data: subscriptionWithSecretSchema,
});
