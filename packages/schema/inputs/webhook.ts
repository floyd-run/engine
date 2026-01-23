import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSubscriptionSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  url: z.string().url(),
  eventTypes: z.array(z.string()).optional(),
  enabled: z.boolean().default(true),
});

export const getSubscriptionSchema = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
});

export const listSubscriptionsSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const updateSubscriptionSchema = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  url: z.string().url().optional(),
  eventTypes: z.array(z.string()).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const deleteSubscriptionSchema = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
});

export const rotateSecretSchema = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
});

export const listDeliveriesSchema = z.object({
  subscriptionId: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  status: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(50)
    .transform((val) => Math.min(val, 100)),
});

export const retryDeliverySchema = z.object({
  id: z.string().refine((id) => isValidId(id, "whd"), { message: "Invalid webhook delivery ID" }),
});
