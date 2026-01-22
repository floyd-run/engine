import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const createSchema = z.object({
  workspaceId: z.string().refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
  timezone: z.string().default("UTC"),
});

export const getSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "res"), { message: "Invalid resource ID" }),
});

export const listSchema = z.object({
  workspaceId: z.string().refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
});

export const removeSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "res"), { message: "Invalid resource ID" }),
});
