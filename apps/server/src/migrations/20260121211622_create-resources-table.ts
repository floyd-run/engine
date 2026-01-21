import type { Database } from "database/schema";
import { Kysely, sql } from "kysely";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("resources")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("workspace_id", "varchar(32)", (col) =>
      col.notNull().references("workspaces.id").onDelete("cascade"),
    )
    .addColumn("timezone", "varchar(100)", (col) => col.notNull().defaultTo("UTC"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex("idx_resources_workspace")
    .on("resources")
    .column("workspace_id")
    .execute();

  await addUpdatedAtTrigger(db, "resources");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("resources").execute();
}
