import type { Database } from "database/schema";
import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  // 1. Create policy_versions table
  await db.schema
    .createTable("policy_versions")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("policy_id", "varchar(32)", (col) => col.notNull().references("policies.id"))
    .addColumn("config", "jsonb", (col) => col.notNull())
    .addColumn("config_source", "jsonb", (col) => col.notNull())
    .addColumn("config_hash", "varchar(64)", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex("idx_policy_versions_policy")
    .on("policy_versions")
    .column("policy_id")
    .execute();

  // 2. Add name, description, current_version_id to policies
  await db.schema.alterTable("policies").addColumn("name", "varchar(100)").execute();

  await db.schema.alterTable("policies").addColumn("description", "varchar(500)").execute();

  await db.schema.alterTable("policies").addColumn("current_version_id", "varchar(32)").execute();

  // 3. Add FK constraint for current_version_id
  await sql`
    ALTER TABLE policies
    ADD CONSTRAINT fk_policies_current_version
    FOREIGN KEY (current_version_id) REFERENCES policy_versions(id)
  `.execute(db);

  // 4. Drop old columns from policies
  await db.schema.dropIndex("idx_policies_config_hash").ifExists().execute();
  await db.schema.alterTable("policies").dropColumn("config").execute();
  await db.schema.alterTable("policies").dropColumn("config_hash").execute();

  // 5. Replace policy_id with policy_version_id on bookings
  await db.schema
    .alterTable("bookings")
    .addColumn("policy_version_id", "varchar(32)", (col) =>
      col.notNull().references("policy_versions.id"),
    )
    .execute();

  await db.schema
    .createIndex("idx_bookings_policy_version")
    .on("bookings")
    .column("policy_version_id")
    .execute();

  // Drop old policy_id column from bookings
  await db.schema.alterTable("bookings").dropColumn("policy_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Restore policy_id on bookings
  await db.schema
    .alterTable("bookings")
    .addColumn("policy_id", "varchar(32)", (col) => col.references("policies.id"))
    .execute();

  await sql`
    UPDATE bookings b
    SET policy_id = pv.policy_id
    FROM policy_versions pv
    WHERE b.policy_version_id = pv.id
  `.execute(db);

  await db.schema.dropIndex("idx_bookings_policy_version").ifExists().execute();
  await db.schema.alterTable("bookings").dropColumn("policy_version_id").execute();

  // Restore config/config_hash on policies from current version
  await db.schema.alterTable("policies").addColumn("config", "jsonb").execute();
  await db.schema.alterTable("policies").addColumn("config_hash", "varchar(64)").execute();

  await sql`
    UPDATE policies p
    SET config = pv.config, config_hash = pv.config_hash
    FROM policy_versions pv
    WHERE p.current_version_id = pv.id
  `.execute(db);

  await sql`ALTER TABLE policies ALTER COLUMN config SET NOT NULL`.execute(db);
  await sql`ALTER TABLE policies ALTER COLUMN config_hash SET NOT NULL`.execute(db);

  await db.schema
    .createIndex("idx_policies_config_hash")
    .on("policies")
    .columns(["ledger_id", "config_hash"])
    .execute();

  // Drop FK constraint, new columns, and policy_versions table
  await sql`ALTER TABLE policies DROP CONSTRAINT IF EXISTS fk_policies_current_version`.execute(db);
  await db.schema.alterTable("policies").dropColumn("current_version_id").execute();
  await db.schema.alterTable("policies").dropColumn("description").execute();
  await db.schema.alterTable("policies").dropColumn("name").execute();
  await db.schema.dropTable("policy_versions").execute();
}
