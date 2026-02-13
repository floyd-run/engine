import { z } from "./zod";
import { BookingStatus } from "../constants";

const bookingAllocationSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  buffer: z.object({
    beforeMs: z.number(),
    afterMs: z.number(),
  }),
  active: z.boolean(),
});

export const base = z.object({
  id: z.string(),
  ledgerId: z.string(),
  serviceId: z.string(),
  policyId: z.string().nullable(),
  status: z.enum([
    BookingStatus.HOLD,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELED,
    BookingStatus.EXPIRED,
  ]),
  expiresAt: z.string().nullable(),
  allocations: z.array(bookingAllocationSchema),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const get = z.object({
  data: base,
  meta: z
    .object({
      serverTime: z.string(),
    })
    .optional(),
});

export const list = z.object({
  data: z.array(base),
});
