import { z } from "./zod";

export const base = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const get = z.object({
  data: base,
});

export const list = z.object({
  data: z.array(base),
});
