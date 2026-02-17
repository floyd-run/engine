import type { Database } from "database/schema";
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  // Drop old webhook tables (moved to cloud)
  await db.schema.dropTable("webhook_deliveries").ifExists().execute();
  await db.schema.dropTable("webhook_subscriptions").ifExists().execute();

  // Drop outbox_events if it exists (to ensure clean schema)
  await db.schema.dropTable("outbox_events").ifExists().execute();

  // Create outbox_events table for internal event bus
  await db.schema
    .createTable("outbox_events")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("ledger_id", "text", (col) => col.notNull())
    .addColumn("event_type", "text", (col) => col.notNull())
    .addColumn("schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("published_at", "timestamptz")
    .addColumn("publish_attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("next_attempt_at", "timestamptz")
    .addColumn("last_publish_error", "text")
    .execute();

  // Index for efficient polling of unpublished events ready for retry
  await db.schema
    .createIndex("outbox_events_pending_idx")
    .on("outbox_events")
    .columns(["next_attempt_at", "created_at"])
    .where(sql.ref("published_at"), "is", null)
    .execute();

  // Index for ledger-based queries
  await db.schema
    .createIndex("outbox_events_ledger_id_idx")
    .on("outbox_events")
    .column("ledger_id")
    .execute();
}

// Intentionally irreversible: webhook tables are not recreated.
// The webhook system has been fully replaced by the internal event bus.
export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("outbox_events").execute();
}
