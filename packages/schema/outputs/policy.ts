import { z } from "./zod";

export const base = z.object({
  id: z.string(),
  ledgerId: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  currentVersionId: z.string(),
  config: z.record(z.string(), z.unknown()),
  configSource: z.record(z.string(), z.unknown()),
  configHash: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const get = z.object({
  data: base,
});

export const list = z.object({
  data: z.array(base),
});
