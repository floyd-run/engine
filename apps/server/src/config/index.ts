import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.url(),
  FLOYD_API_KEY: z.string().min(1).optional(),
  FLOYD_EVENT_INGEST_URL: z.url().optional(),
  FLOYD_ENGINE_SECRET: z.string().min(1).optional(),
});

export const config = schema.parse(process.env);

export type Config = z.infer<typeof schema>;
