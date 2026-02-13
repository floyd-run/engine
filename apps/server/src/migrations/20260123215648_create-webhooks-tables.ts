import type { Database } from "database/schema";
import { type Kysely, sql } from "kysely";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  // Webhook subscriptions - defines where to send events
  await db.schema
    .createTable("webhook_subscriptions")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("url", "text", (col) => col.notNull())
    .addColumn("secret", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex("idx_webhook_subscriptions_ledger")
    .on("webhook_subscriptions")
    .column("ledger_id")
    .execute();

  await addUpdatedAtTrigger(db, "webhook_subscriptions");

  // Webhook deliveries - outbox for pending deliveries
  await db.schema
    .createTable("webhook_deliveries")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("subscription_id", "varchar(32)", (col) =>
      col.notNull().references("webhook_subscriptions.id").onDelete("cascade"),
    )
    .addColumn("event_type", "varchar(100)", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) =>
      col
        .notNull()
        .check(sql`status IN ('pending', 'in_flight', 'succeeded', 'failed', 'exhausted')`),
    )
    .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("max_attempts", "integer", (col) => col.notNull().defaultTo(5))
    .addColumn("next_attempt_at", "timestamptz")
    .addColumn("last_error", "text")
    .addColumn("last_status_code", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Index for polling pending deliveries
  await db.schema
    .createIndex("idx_webhook_deliveries_pending")
    .on("webhook_deliveries")
    .columns(["status", "next_attempt_at"])
    .where("status", "in", ["pending", "failed"])
    .execute();

  // Index for subscription cleanup
  await db.schema
    .createIndex("idx_webhook_deliveries_subscription")
    .on("webhook_deliveries")
    .column("subscription_id")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("webhook_deliveries").execute();
  await db.schema.dropTable("webhook_subscriptions").execute();
}
