import { z } from "./zod";

export const schema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  resourceId: z.string(),
  bookingId: z.string().nullable(),
  active: z.boolean(),
  startAt: z.string(),
  endAt: z.string(),
  bufferBeforeMs: z.number(),
  bufferAfterMs: z.number(),
  expiresAt: z.string().nullable(),
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
