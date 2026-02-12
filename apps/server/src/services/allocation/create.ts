import { db, getServerTime } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { allocation } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";

export default createService({
  input: allocation.createSchema,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock the resource row (FOR UPDATE) - serializes concurrent writes
      const resource = await trx
        .selectFrom("resources")
        .selectAll()
        .where("id", "=", input.resourceId)
        .forUpdate()
        .executeTakeFirst();

      if (!resource) {
        throw new NotFoundError("Resource not found");
      }

      // 2. Capture server time immediately after acquiring lock
      const serverTime = await getServerTime(trx);

      // 3. Check for overlapping allocations that would block this request
      // Blocking allocations are: confirmed OR (hold AND not expired)
      const conflicting = await trx
        .selectFrom("allocations")
        .select(["id", "status", "startAt", "endAt"])
        .where("resourceId", "=", input.resourceId)
        .where((eb) =>
          eb.or([
            eb("status", "=", "confirmed"),
            eb.and([eb("status", "=", "hold"), eb("expiresAt", ">", serverTime)]),
          ]),
        )
        // Overlap condition: existing.start < new.end AND existing.end > new.start
        .where("startAt", "<", input.endAt)
        .where("endAt", ">", input.startAt)
        .execute();

      if (conflicting.length > 0) {
        throw new ConflictError("overlap_conflict", {
          conflictingAllocationIds: conflicting.map((a) => a.id),
        });
      }

      // 4. Compute expiresAt for holds
      // Holds require expiresAt; default to 15 minutes from serverTime if not provided
      // Confirmed allocations must have null expiresAt
      let expiresAt: Date | null = null;
      if (input.status === "hold") {
        if (input.expiresAt) {
          expiresAt = input.expiresAt;
        } else {
          expiresAt = new Date(serverTime.getTime() + 15 * 60 * 1000); // 15 minutes
        }
      }

      // 5. Insert the allocation
      const alloc = await trx
        .insertInto("allocations")
        .values({
          id: generateId("alc"),
          ledgerId: input.ledgerId,
          resourceId: input.resourceId,
          status: input.status,
          startAt: input.startAt,
          endAt: input.endAt,
          expiresAt,
          metadata: input.metadata ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 6. Enqueue webhook event (in same transaction)
      await enqueueWebhookEvent(trx, "allocation.created", input.ledgerId, alloc);

      return { allocation: alloc, serverTime };
    });
  },
});
