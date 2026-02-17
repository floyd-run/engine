import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const create = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().max(255).nullable().optional(),
  timezone: z
    .string()
    .max(64)
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      { message: "Invalid IANA timezone" },
    ),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const list = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const remove = z.object({
  id: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
