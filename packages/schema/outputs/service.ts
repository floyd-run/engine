import { z } from "./zod";

export const base = z.object({
  id: z.string(),
  ledgerId: z.string(),
  name: z.string().nullable(),
  policyId: z.string().nullable(),
  resourceIds: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const get = z.object({
  data: base,
});

export const list = z.object({
  data: z.array(base),
});
