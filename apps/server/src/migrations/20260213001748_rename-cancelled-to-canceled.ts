import type { Database } from "database/schema";
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<Database>): Promise<void> {
  // 1. Drop old constraints first (they reference 'cancelled')
  await sql`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`.execute(db);
  await sql`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_expires_at_consistency`.execute(
    db,
  );

  // 2. Update existing rows
  await sql`UPDATE bookings SET status = 'canceled' WHERE status = 'cancelled'`.execute(db);

  // 3. Re-add constraints with 'canceled' spelling
  await sql`ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('hold', 'confirmed', 'canceled', 'expired'))`.execute(
    db,
  );
  await sql`ALTER TABLE bookings ADD CONSTRAINT bookings_expires_at_consistency CHECK ((status = 'hold' AND expires_at IS NOT NULL) OR (status IN ('confirmed', 'canceled', 'expired') AND expires_at IS NULL))`.execute(
    db,
  );
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check`.execute(db);
  await sql`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_expires_at_consistency`.execute(
    db,
  );

  await sql`UPDATE bookings SET status = 'cancelled' WHERE status = 'canceled'`.execute(db);

  await sql`ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('hold', 'confirmed', 'cancelled', 'expired'))`.execute(
    db,
  );
  await sql`ALTER TABLE bookings ADD CONSTRAINT bookings_expires_at_consistency CHECK ((status = 'hold' AND expires_at IS NOT NULL) OR (status IN ('confirmed', 'cancelled', 'expired') AND expires_at IS NULL))`.execute(
    db,
  );
}
