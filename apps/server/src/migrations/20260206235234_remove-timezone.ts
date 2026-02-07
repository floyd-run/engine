import type { Database } from "database/schema";
import { Kysely } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("resources").dropColumn("timezone").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("resources")
    .addColumn("timezone", "varchar(100)", (col) => col.notNull().defaultTo("UTC"))
    .execute();
}
