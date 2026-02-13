import { z } from "./zod";

export const schema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    issues: z.array(z.unknown()).optional(),
  }),
});
