import type { Database } from "database/schema";
import { type Kysely, sql } from "kysely";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("allocations")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("resource_id", "varchar(32)", (col) => col.notNull().references("resources.id"))
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().check(sql`status IN ('hold', 'confirmed', 'cancelled', 'expired')`),
    )
    .addColumn("start_at", "timestamptz", (col) => col.notNull())
    .addColumn("end_at", "timestamptz", (col) => col.notNull())
    .addCheckConstraint("allocations_time_order", sql`start_at < end_at`)
    .addColumn("expires_at", "timestamptz")
    .addCheckConstraint(
      "allocations_expires_at_consistency",
      sql`(status = 'hold' AND expires_at IS NOT NULL) OR (status IN ('confirmed', 'cancelled', 'expired') AND expires_at IS NULL)`,
    )
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Critical indexes for overlap queries
  await db.schema
    .createIndex("idx_allocations_ledger")
    .on("allocations")
    .column("ledger_id")
    .execute();

  await db.schema
    .createIndex("idx_allocations_resource")
    .on("allocations")
    .columns(["ledger_id", "resource_id"])
    .execute();

  await db.schema
    .createIndex("idx_allocations_status")
    .on("allocations")
    .column("status")
    .execute();

  await db.schema
    .createIndex("idx_allocations_expires_at")
    .on("allocations")
    .column("expires_at")
    .where("expires_at", "is not", null)
    .execute();

  // GiST index for range overlap queries (requires btree_gist extension)
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`.execute(db);
  await sql`
    CREATE INDEX idx_allocations_time_range ON allocations
    USING GIST (resource_id, tstzrange(start_at, end_at, '[)'))
  `.execute(db);

  await addUpdatedAtTrigger(db, "allocations");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("allocations").execute();
}
