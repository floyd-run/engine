import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { allocation } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeAllocation } from "routes/v1/serializers";

export default createOperation({
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

      // 3. Check for overlapping active allocations (not expired)
      const conflicting = await trx
        .selectFrom("allocations")
        .select("id")
        .where("resourceId", "=", input.resourceId)
        .where("active", "=", true)
        .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", serverTime)]))
        .where("startAt", "<", input.endAt)
        .where("endAt", ">", input.startAt)
        .execute();

      if (conflicting.length > 0) {
        throw new ConflictError("overlap_conflict", {
          conflictingAllocationIds: conflicting.map((a) => a.id),
        });
      }

      // 4. Insert the allocation
      const alloc = await trx
        .insertInto("allocations")
        .values({
          id: generateId("alc"),
          ledgerId: input.ledgerId,
          resourceId: input.resourceId,
          bookingId: null,
          active: true,
          startAt: input.startAt,
          endAt: input.endAt,
          bufferBeforeMs: 0,
          bufferAfterMs: 0,
          expiresAt: input.expiresAt ?? null,
          metadata: input.metadata ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Enqueue webhook event (in same transaction)
      await enqueueWebhookEvent(trx, "allocation.created", input.ledgerId, {
        allocation: serializeAllocation(alloc),
      });

      return { allocation: alloc, serverTime };
    });
  },
});
