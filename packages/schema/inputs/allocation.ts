import z from "zod";
import { isValidId } from "@floyd-run/utils";
import { AllocationStatus } from "../constants";

export const createSchema = z.object({
  workspaceId: z.string().refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
  resourceId: z.string().refine((id) => isValidId(id, "res"), { message: "Invalid resource ID" }),
  status: z.enum(AllocationStatus),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  expiresAt: z.coerce.date().nullable().optional(),
  version: z.number().int().min(1).default(1),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const getSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "alloc"), { message: "Invalid allocation ID" }),
});

export const listSchema = z.object({
  workspaceId: z.string().refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
});

export const removeSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "alloc"), { message: "Invalid allocation ID" }),
});
