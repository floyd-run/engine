import type { Database } from "database/schema";
import { Kysely, sql } from "kysely";
import { addUpdatedAtTrigger } from "./utils";

export async function up(db: Kysely<Database>): Promise<void> {
  // 1. Add timezone to resources
  await db.schema.alterTable("resources").addColumn("timezone", "varchar(64)").execute();

  // 2. Create services table
  await db.schema
    .createTable("services")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("policy_id", "varchar(32)", (col) => col.references("policies.id"))
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.createIndex("idx_services_ledger").on("services").column("ledger_id").execute();

  await addUpdatedAtTrigger(db, "services");

  // 3. Create service_resources join table
  await db.schema
    .createTable("service_resources")
    .addColumn("service_id", "varchar(32)", (col) =>
      col.notNull().references("services.id").onDelete("cascade"),
    )
    .addColumn("resource_id", "varchar(32)", (col) => col.notNull().references("resources.id"))
    .addPrimaryKeyConstraint("service_resources_pk", ["service_id", "resource_id"])
    .execute();

  await db.schema
    .createIndex("idx_service_resources_resource")
    .on("service_resources")
    .column("resource_id")
    .execute();

  // 4. Create bookings table
  await db.schema
    .createTable("bookings")
    .addColumn("id", "varchar(32)", (col) => col.primaryKey().notNull())
    .addColumn("ledger_id", "varchar(32)", (col) => col.notNull().references("ledgers.id"))
    .addColumn("service_id", "varchar(32)", (col) => col.notNull().references("services.id"))
    .addColumn("policy_id", "varchar(32)", (col) => col.references("policies.id"))
    .addColumn("status", "varchar(50)", (col) =>
      col.notNull().check(sql`status IN ('hold', 'confirmed', 'canceled', 'expired')`),
    )
    .addColumn("expires_at", "timestamptz")
    .addCheckConstraint(
      "bookings_expires_at_consistency",
      sql`(status = 'hold' AND expires_at IS NOT NULL) OR (status IN ('confirmed', 'canceled', 'expired') AND expires_at IS NULL)`,
    )
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.createIndex("idx_bookings_ledger").on("bookings").column("ledger_id").execute();

  await db.schema.createIndex("idx_bookings_service").on("bookings").column("service_id").execute();

  await db.schema.createIndex("idx_bookings_status").on("bookings").column("status").execute();

  await db.schema
    .createIndex("idx_bookings_expires_at")
    .on("bookings")
    .column("expires_at")
    .where("expires_at", "is not", null)
    .execute();

  await addUpdatedAtTrigger(db, "bookings");

  // 5. Modify allocations table
  // Rename time columns: start_at → start_time, end_at → end_time
  await sql`DROP INDEX IF EXISTS idx_allocations_time_range`.execute(db);
  await sql`ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_time_order`.execute(db);
  await db.schema.alterTable("allocations").renameColumn("start_at", "start_time").execute();
  await db.schema.alterTable("allocations").renameColumn("end_at", "end_time").execute();
  await sql`ALTER TABLE allocations ADD CONSTRAINT allocations_time_order CHECK (start_time < end_time)`.execute(
    db,
  );

  // Add new columns
  await db.schema
    .alterTable("allocations")
    .addColumn("booking_id", "varchar(32)", (col) => col.references("bookings.id"))
    .execute();

  await db.schema
    .alterTable("allocations")
    .addColumn("active", "boolean", (col) => col.notNull().defaultTo(true))
    .execute();

  // Data migration: set active based on current status
  await sql`UPDATE allocations SET active = (status IN ('hold', 'confirmed'))`.execute(db);

  // Drop old constraints and status column
  await sql`ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_expires_at_consistency`.execute(
    db,
  );
  await sql`ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_status_check`.execute(db);
  await db.schema.alterTable("allocations").dropColumn("status").execute();

  // Add buffer columns
  await db.schema
    .alterTable("allocations")
    .addColumn("buffer_before_ms", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  await db.schema
    .alterTable("allocations")
    .addColumn("buffer_after_ms", "integer", (col) => col.notNull().defaultTo(0))
    .execute();

  // Drop old indexes
  await db.schema.dropIndex("idx_allocations_status").ifExists().execute();

  // Add new indexes
  await sql`
    CREATE INDEX idx_allocations_active
    ON allocations(resource_id, start_time, end_time)
    WHERE active = true
  `.execute(db);

  await sql`
    CREATE INDEX idx_allocations_booking
    ON allocations(booking_id)
    WHERE booking_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Drop new indexes
  await sql`DROP INDEX IF EXISTS idx_allocations_booking`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_allocations_active`.execute(db);

  // Re-add status column
  await db.schema
    .alterTable("allocations")
    .addColumn("status", "varchar(50)", (col) =>
      col
        .notNull()
        .defaultTo("confirmed")
        .check(sql`status IN ('hold', 'confirmed', 'cancelled', 'expired')`),
    )
    .execute();

  // Migrate data back
  await sql`UPDATE allocations SET status = CASE WHEN active = true THEN 'confirmed' ELSE 'expired' END`.execute(
    db,
  );

  // Re-add constraints
  await sql`
    ALTER TABLE allocations ADD CONSTRAINT allocations_expires_at_consistency
    CHECK ((status = 'hold' AND expires_at IS NOT NULL) OR (status IN ('confirmed', 'cancelled', 'expired') AND expires_at IS NULL))
  `.execute(db);

  // Re-add old indexes
  await db.schema
    .createIndex("idx_allocations_status")
    .on("allocations")
    .column("status")
    .execute();

  // Drop new columns
  await db.schema.alterTable("allocations").dropColumn("buffer_after_ms").execute();
  await db.schema.alterTable("allocations").dropColumn("buffer_before_ms").execute();
  await db.schema.alterTable("allocations").dropColumn("active").execute();
  await db.schema.alterTable("allocations").dropColumn("booking_id").execute();

  // Drop new tables (reverse order)
  await db.schema.dropTable("bookings").execute();
  await db.schema.dropTable("service_resources").execute();
  await db.schema.dropTable("services").execute();

  // Reverse column renames: start_time → start_at, end_time → end_at
  await sql`ALTER TABLE allocations DROP CONSTRAINT IF EXISTS allocations_time_order`.execute(db);
  await db.schema.alterTable("allocations").renameColumn("start_time", "start_at").execute();
  await db.schema.alterTable("allocations").renameColumn("end_time", "end_at").execute();
  await sql`ALTER TABLE allocations ADD CONSTRAINT allocations_time_order CHECK (start_at < end_at)`.execute(
    db,
  );
  await sql`
    CREATE INDEX idx_allocations_time_range ON allocations
    USING GIST (resource_id, tstzrange(start_at, end_at, '[)'))
  `.execute(db);

  // Remove timezone from resources
  await db.schema.alterTable("resources").dropColumn("timezone").execute();
}
