import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const create = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().max(255).nullable().optional(),
  policyId: z
    .string()
    .refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" })
    .nullable()
    .optional(),
  resourceIds: z
    .array(z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }))
    .default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const update = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().max(255).nullable().optional(),
  policyId: z
    .string()
    .refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" })
    .nullable()
    .optional(),
  resourceIds: z
    .array(z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }))
    .default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const list = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const remove = z.object({
  id: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
