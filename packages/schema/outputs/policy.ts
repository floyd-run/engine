import { z } from "./zod";

export const schema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  config: z.record(z.string(), z.unknown()),
  configHash: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getSchema = z.object({
  data: schema,
});

export const listSchema = z.object({
  data: z.array(schema),
});
