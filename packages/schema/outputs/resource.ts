import { z } from "./zod";

export const schema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getSchema = z.object({
  data: schema,
});

export const listSchema = z.object({
  data: z.array(schema),
});
