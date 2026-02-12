import { z } from "./zod";

export const schema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  name: z.string(),
  policyId: z.string().nullable(),
  resourceIds: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getSchema = z.object({
  data: schema,
});

export const listSchema = z.object({
  data: z.array(schema),
});
