import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const create = z
  .object({
    ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
    resourceId: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    expiresAt: z.coerce.date().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: "endAt must be after startAt",
    path: ["endAt"],
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
