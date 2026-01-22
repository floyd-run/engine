import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  FLOYD_API_KEY: z.string().min(1).optional(),
});

export const config = schema.parse(process.env);

export type Config = z.infer<typeof schema>;
