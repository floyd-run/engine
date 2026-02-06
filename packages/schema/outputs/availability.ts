import { z } from "./zod";

export const timelineBlockSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["free", "busy"]),
});

export const itemSchema = z.object({
  resourceId: z.string(),
  timeline: z.array(timelineBlockSchema),
});

export const querySchema = z.object({
  data: z.array(itemSchema),
});
