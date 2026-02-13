import { z } from "./zod";

export const timelineBlock = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["free", "busy"]),
});

export const item = z.object({
  resourceId: z.string(),
  timeline: z.array(timelineBlock),
});

export const query = z.object({
  data: z.array(item),
});

// ─── Service Availability ────────────────────────────────────────────────────

export const slot = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["available", "unavailable"]).optional(),
});

export const resourceSlots = z.object({
  resourceId: z.string(),
  timezone: z.string(),
  slots: z.array(slot),
});

export const slotsResponse = z.object({
  data: z.array(resourceSlots),
  meta: z.object({ serverTime: z.string() }),
});

export const window = z.object({
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(["available", "unavailable"]).optional(),
});

export const resourceWindows = z.object({
  resourceId: z.string(),
  timezone: z.string(),
  windows: z.array(window),
});

export const windowsResponse = z.object({
  data: z.array(resourceWindows),
  meta: z.object({ serverTime: z.string() }),
});
