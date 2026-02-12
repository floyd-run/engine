import { sql, type Kysely } from "kysely";
import type { Database } from "./schema";

export async function getServerTime(trx: Kysely<Database>): Promise<Date> {
  const result = await sql<{
    serverTime: Date;
  }>`SELECT clock_timestamp() AS server_time`.execute(trx);
  return result.rows[0]!.serverTime;
}
