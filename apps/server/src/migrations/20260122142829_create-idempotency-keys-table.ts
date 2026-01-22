import type { Database } from "database/schema";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("idempotency_keys")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("workspace_id", "varchar(32)", (col) => col.notNull().references("workspaces.id"))
    .addColumn("key", "varchar(255)", (col) => col.notNull())
    .addColumn("path", "varchar(255)", (col) => col.notNull())
    .addColumn("method", "varchar(10)", (col) => col.notNull())
    .addColumn("payload_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("response_status", "integer", (col) => col.notNull())
    .addColumn("response_body", "jsonb", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Unique constraint on workspace + key
  await db.schema
    .createIndex("idx_idempotency_keys_workspace_key")
    .on("idempotency_keys")
    .columns(["workspace_id", "key"])
    .unique()
    .execute();

  // Index for cleanup of expired keys
  await db.schema
    .createIndex("idx_idempotency_keys_expires_at")
    .on("idempotency_keys")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("idempotency_keys").execute();
}
