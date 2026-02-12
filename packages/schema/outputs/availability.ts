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

// ─── Service Availability ────────────────────────────────────────────────────

export const slotSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["available", "unavailable"]).optional(),
});

export const resourceSlotsSchema = z.object({
  resourceId: z.string(),
  timezone: z.string(),
  slots: z.array(slotSchema),
});

export const slotsResponseSchema = z.object({
  data: z.array(resourceSlotsSchema),
  meta: z.object({ serverTime: z.string() }),
});

export const windowSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["available", "unavailable"]).optional(),
});

export const resourceWindowsSchema = z.object({
  resourceId: z.string(),
  timezone: z.string(),
  windows: z.array(windowSchema),
});

export const windowsResponseSchema = z.object({
  data: z.array(resourceWindowsSchema),
  meta: z.object({ serverTime: z.string() }),
});
