import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from 'database/schema';

export async function addUpdatedAtTrigger(db: Kysely<Database>, table: string) {
  await sql`
    CREATE TRIGGER ${sql.raw(table)}_modtime
    BEFORE UPDATE ON ${sql.table(table)}
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
  `.execute(db);
}