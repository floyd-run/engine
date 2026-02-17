import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const create = z
  .object({
    ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
    resourceId: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    expiresAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "alc"), { message: "Invalid allocation ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const list = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const remove = z.object({
  id: z.string().refine((id) => isValidId(id, "alc"), { message: "Invalid allocation ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
