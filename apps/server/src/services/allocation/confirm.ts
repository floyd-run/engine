import { db } from "database";
import { sql } from "kysely";
import { createService } from "lib/service";
import { allocation } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";

export default createService({
  input: allocation.confirmSchema,
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

      // 2. Capture server time after acquiring lock
      const result = await sql<{
        serverTime: Date;
      }>`SELECT clock_timestamp() AS server_time`.execute(trx);
      const serverTime = result.rows[0]!.serverTime;

      // 3. Validate state transition
      if (existing.status === "confirmed") {
        // Already confirmed - idempotent success
        return { allocation: existing, serverTime };
      }

      if (existing.status === "cancelled") {
        throw new ConflictError("invalid_state_transition", {
          currentStatus: existing.status,
          requestedStatus: "confirmed",
          message: "Cannot confirm a cancelled allocation",
        });
      }

      if (existing.status === "expired") {
        throw new ConflictError("invalid_state_transition", {
          currentStatus: existing.status,
          requestedStatus: "confirmed",
          message: "Cannot confirm an expired allocation",
        });
      }

      // 4. For holds, check if expired based on server time
      if (existing.status === "hold" && existing.expiresAt) {
        if (serverTime >= existing.expiresAt) {
          throw new ConflictError("hold_expired", {
            expiresAt: existing.expiresAt,
            serverTime,
          });
        }
      }

      // 5. Update to confirmed (clear expires_at per database constraint)
      const allocation = await trx
        .updateTable("allocations")
        .set({
          status: "confirmed",
          expiresAt: null,
          updatedAt: serverTime,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 6. Enqueue webhook event (in same transaction)
      await enqueueWebhookEvent(trx, "allocation.confirmed", allocation.ledgerId, allocation);

      return { allocation, serverTime };
    });
  },
});
