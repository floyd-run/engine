import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { allocationInput } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeAllocation } from "routes/v1/serializers";

export default createOperation({
  input: allocationInput.remove,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock the allocation row
      const existing = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Allocation not found");
      }

      // 2. Cannot delete booking-owned allocations
      if (existing.bookingId !== null) {
        throw new ConflictError("allocation.managed_by_booking", {
          bookingId: existing.bookingId,
        });
      }

      // 3. Hard delete the allocation
      await trx.deleteFrom("allocations").where("id", "=", input.id).execute();

      // 4. Enqueue webhook event
      await enqueueWebhookEvent(trx, "allocation.deleted", existing.ledgerId, {
        allocation: serializeAllocation(existing),
      });

      return { deleted: true };
    });
  },
});
