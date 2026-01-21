import { sql } from "kysely";
import type { Kysely } from "kysely";
import type { Database } from "database/schema";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("workspaces")
    .addColumn("workspace_id", "varchar(255)", (col) => col.primaryKey())
    .addColumn("description", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await addUpdatedAtTrigger(db, "workspaces");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("workspaces").execute();
}
