import type { Kysely } from "kysely";
import type { Database } from "../schema";

export function createResourceRepository(db: Kysely<Database>) {
  return {
    findById: (id: string) => db.selectFrom("resources").where("id", "=", id).executeTakeFirst(),
  };
}
