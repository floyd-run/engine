import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "database/schema";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  // Initial extensions
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto;`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist;`.execute(db);

  // Update modified column function
  await sql`
    CREATE OR REPLACE FUNCTION update_modified_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `.execute(db);

  await db.schema
    .createTable("resources")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("timezone", "text", (col) => col.notNull())
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await addUpdatedAtTrigger(db, "resources");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("resources").execute();
}
