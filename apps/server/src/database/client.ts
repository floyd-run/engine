import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import type { Database } from "./schema";
import { Pool } from "pg";
import { config } from "config";

const pool = new Pool({ connectionString: config.DATABASE_URL });
const dialect = new PostgresDialect({ pool });
export const db = new Kysely<Database>({
  dialect,
  plugins: [new CamelCasePlugin({ maintainNestedObjectKeys: true })],
});
