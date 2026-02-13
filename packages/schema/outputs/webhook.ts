import { z } from "./zod";

export const subscription = z.object({
  id: z.string(),
  ledgerId: z.string(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const subscriptionWithSecret = subscription.extend({
  secret: z.string(),
});

export const createSubscription = z.object({
  data: subscriptionWithSecret,
});

export const listSubscriptions = z.object({
  data: z.array(subscription),
});

export const updateSubscription = z.object({
  data: subscription,
});

export const rotateSecret = z.object({
  data: subscriptionWithSecret,
});
