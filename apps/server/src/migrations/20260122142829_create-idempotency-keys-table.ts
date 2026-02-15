import type { Database } from "database/schema";
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("idempotency_keys")
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("key", "varchar(255)", (col) => col.notNull())
    .addColumn("path", "varchar(255)", (col) => col.notNull())
    .addColumn("method", "varchar(10)", (col) => col.notNull())
    .addColumn("payload_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col.notNull().check(sql`status IN ('in_progress', 'completed')`),
    )
    .addColumn("response_status", "integer")
    .addColumn("response_body", "jsonb")
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Primary key on ledger + key
  await db.schema
    .alterTable("idempotency_keys")
    .addPrimaryKeyConstraint("idempotency_keys_pkey", ["ledger_id", "key"])
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
