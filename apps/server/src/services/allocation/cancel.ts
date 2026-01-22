import { sql } from "kysely";
import { db } from "database";
import { createService } from "lib/service";
import { allocation } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";

export default createService({
  input: allocation.cancelSchema,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Get the allocation with lock
      const existing = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("id", "=", input.id)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Allocation not found");
      }

      // 2. Capture server time
      const result = await sql<{ serverTime: Date }>`SELECT NOW() AS server_time`.execute(trx);
      const serverTime = result.rows[0]!.serverTime;

      // 3. Validate state transition
      if (existing.status === "cancelled") {
        // Already cancelled - idempotent success
        return { allocation: existing, serverTime };
      }

      if (existing.status === "expired") {
        throw new ConflictError("invalid_state_transition", {
          currentStatus: existing.status,
          requestedStatus: "cancelled",
          message: "Cannot cancel an expired allocation",
        });
      }

      // 4. Update to cancelled (valid from hold or confirmed)
      const allocation = await trx
        .updateTable("allocations")
        .set({
          status: "cancelled",
          updatedAt: serverTime,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return { allocation, serverTime };
    });
  },
});
