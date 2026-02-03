import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSubscriptionSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  url: z.string().url(),
});

export const listSubscriptionsSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const updateSubscriptionSchema = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  url: z.string().url().optional(),
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
