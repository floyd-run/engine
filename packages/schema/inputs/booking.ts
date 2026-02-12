import z from "zod";
import { isValidId } from "@floyd-run/utils";
import { BookingStatus } from "../constants";

export const createSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  serviceId: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  resourceId: z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  status: z.enum([BookingStatus.HOLD, BookingStatus.CONFIRMED]).default(BookingStatus.HOLD),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const getSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
});

export const listSchema = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const confirmSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
});

export const cancelSchema = z.object({
  id: z.string().refine((id) => isValidId(id, "bkg"), { message: "Invalid booking ID" }),
});
