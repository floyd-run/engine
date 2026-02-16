import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { allocationInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";
import { emitEvent } from "infra/event-bus";
import { serializeAllocation } from "routes/v1/serializers";
import { insertAllocation } from "./internal/insert";

export default createOperation({
  input: allocationInput.create,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock the resource row (FOR UPDATE) - serializes concurrent writes
      const resource = await trx
        .selectFrom("resources")
        .selectAll()
        .where("id", "=", input.resourceId)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!resource) {
        throw new NotFoundError("Resource not found");
      }

      // 2. Capture server time immediately after acquiring lock
      const serverTime = await getServerTime(trx);

      // 3. Check conflicts + insert allocation
      const allocation = await insertAllocation(trx, {
        ledgerId: input.ledgerId,
        resourceId: input.resourceId,
        bookingId: null,
        startTime: input.startTime,
        endTime: input.endTime,
        bufferBeforeMs: 0,
        bufferAfterMs: 0,
        expiresAt: input.expiresAt ?? null,
        metadata: input.metadata ?? null,
        serverTime,
      });

      // 4. Emit event to outbox (in same transaction)
      await emitEvent(trx, "allocation.created", input.ledgerId, {
        allocation: serializeAllocation(allocation),
      });

      return { allocation, serverTime };
    });
  },
});
