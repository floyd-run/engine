import z from "zod";
import { isValidId } from "@floyd-run/utils";
import { BookingStatus } from "../constants";

export const create = z
  .object({
    ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
    serviceId: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
    resourceId: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    status: z.enum([BookingStatus.HOLD, BookingStatus.CONFIRMED]).default(BookingStatus.HOLD),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const list = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const confirm = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const cancel = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
