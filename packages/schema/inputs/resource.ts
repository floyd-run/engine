import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  timezone: z.string().max(64).nullable().optional(),
});

export const getSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
});

export const listSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const removeSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
});
