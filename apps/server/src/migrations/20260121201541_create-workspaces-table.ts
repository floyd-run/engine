import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "database/schema";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
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
    .createTable("workspaces")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await addUpdatedAtTrigger(db, "workspaces");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("workspaces").execute();
}
