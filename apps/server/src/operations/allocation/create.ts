import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { allocation } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeAllocation } from "routes/v1/serializers";
import { insertAllocation } from "./internal/insert";

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

      // 3. Check conflicts + insert allocation
      const alloc = await insertAllocation(trx, {
        ledgerId: input.ledgerId,
        resourceId: input.resourceId,
        bookingId: null,
        startAt: input.startAt,
        endAt: input.endAt,
        bufferBeforeMs: 0,
        bufferAfterMs: 0,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
        serverTime,
      });

      // 4. Enqueue webhook event (in same transaction)
      await enqueueWebhookEvent(trx, "allocation.created", input.ledgerId, {
        allocation: serializeAllocation(alloc),
      });

      return { allocation: alloc, serverTime };
    });
  },
});
