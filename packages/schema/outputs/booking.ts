import { z } from "./zod";
import { BookingStatus } from "../constants";

const bookingAllocationSchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  active: z.boolean(),
});

export const schema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  serviceId: z.string(),
  status: z.enum([
    BookingStatus.HOLD,
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
  ]),
  expiresAt: z.string().nullable(),
  allocations: z.array(bookingAllocationSchema),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getSchema = z.object({
  data: schema,
  meta: z
    .object({
      serverTime: z.string(),
    })
    .optional(),
});

export const listSchema = z.object({
  data: z.array(schema),
});
