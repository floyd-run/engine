import { z } from "./zod";

export const schema = z.object({
  error: z.union([
    z.string(),
    z.object({
      code: z.string(),
      message: z.string().optional(),
      details: z.record(z.string(), z.unknown()).optional(),
    }),
  ]),
});
