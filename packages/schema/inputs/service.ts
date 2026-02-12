import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().min(1).max(255),
  policyId: z
    .string()
    .refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" })
    .nullable()
    .optional(),
  resourceIds: z
    .array(z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }))
    .default([]),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const updateSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().min(1).max(255),
  policyId: z
    .string()
    .refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" })
    .nullable()
    .optional(),
  resourceIds: z
    .array(z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }))
    .default([]),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const getSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const listSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const removeSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
