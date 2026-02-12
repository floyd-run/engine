import type { Database } from "database/schema";
import { Kysely, sql } from "kysely";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("policies")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("config", "jsonb", (col) => col.notNull())
    .addColumn("config_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.createIndex("idx_policies_ledger").on("policies").column("ledger_id").execute();

  await db.schema
    .createIndex("idx_policies_config_hash")
    .on("policies")
    .columns(["ledger_id", "config_hash"])
    .execute();

  await addUpdatedAtTrigger(db, "policies");
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("policies").execute();
}
