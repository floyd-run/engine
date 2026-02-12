import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSubscription = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  url: z.string().url(),
});

export const listSubscriptions = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const updateSubscription = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  url: z.string().url().optional(),
});

export const deleteSubscription = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const rotateSecret = z.object({
  id: z
    .string()
    .refine((id) => isValidId(id, "whs"), { message: "Invalid webhook subscription ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
