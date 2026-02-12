import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { booking } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeBooking } from "routes/v1/serializers";
import { evaluatePolicy, type PolicyConfig } from "domain/policy/evaluate";
import { insertAllocation } from "../allocation/internal/insert";

const DEFAULT_HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default createOperation({
  input: booking.createSchema,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock resource row (serializes concurrent writes)
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

      // 2. Capture server time
      const serverTime = await getServerTime(trx);

      // 3. Load service
      const service = await trx
        .selectFrom("services")
        .selectAll()
        .where("id", "=", input.serviceId)
        .where("ledgerId", "=", input.ledgerId)
        .executeTakeFirst();

      if (!service) {
        throw new NotFoundError("Service not found");
      }

      // 4. Verify resource belongs to service
      const serviceResource = await trx
        .selectFrom("serviceResources")
        .select("resourceId")
        .where("serviceId", "=", input.serviceId)
        .where("resourceId", "=", input.resourceId)
        .executeTakeFirst();

      if (!serviceResource) {
        throw new ConflictError("resource_not_in_service", {
          serviceId: input.serviceId,
          resourceId: input.resourceId,
        });
      }

      // 5. Policy evaluation (if service has a policy)
      let holdDurationMs = DEFAULT_HOLD_DURATION_MS;
      let startAt = input.startAt;
      let endAt = input.endAt;
      let bufferBeforeMs = 0;
      let bufferAfterMs = 0;
      if (service.policyId) {
        const policy = await trx
          .selectFrom("policies")
          .selectAll()
          .where("id", "=", service.policyId)
          .executeTakeFirst();

        if (policy) {
          const timezone = resource.timezone ?? "UTC";
          const result = evaluatePolicy(
            policy.config as unknown as PolicyConfig,
            { startAt: input.startAt, endAt: input.endAt },
            { decisionTime: serverTime, timezone },
          );

          if (!result.allowed) {
            throw new ConflictError("policy_rejected", {
              code: result.code,
              message: result.message,
              ...("details" in result ? { details: result.details } : {}),
            });
          }

          // Use buffer-expanded times as the allocation's blocked window
          startAt = result.effectiveStartAt;
          endAt = result.effectiveEndAt;
          bufferBeforeMs = result.bufferBeforeMs;
          bufferAfterMs = result.bufferAfterMs;

          // Use policy hold_duration if configured
          const configRecord = policy.config as Record<string, unknown>;
          if (
            configRecord["hold_duration_ms"] &&
            typeof configRecord["hold_duration_ms"] === "number"
          ) {
            holdDurationMs = configRecord["hold_duration_ms"];
          }
        }
      }

      // 6. Compute expiresAt
      const isHold = input.status === "hold";
      const expiresAt = isHold ? new Date(serverTime.getTime() + holdDurationMs) : null;

      // 7. Insert booking
      const bkg = await trx
        .insertInto("bookings")
        .values({
          id: generateId("bkg"),
          ledgerId: input.ledgerId,
          serviceId: input.serviceId,
          policyId: service.policyId,
          status: input.status,
          expiresAt,
          metadata: input.metadata ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 8. Conflict check + insert allocation (startAt/endAt = blocked window including buffers)
      const alloc = await insertAllocation(trx, {
        ledgerId: input.ledgerId,
        resourceId: input.resourceId,
        bookingId: bkg.id,
        startAt,
        endAt,
        bufferBeforeMs,
        bufferAfterMs,
        expiresAt,
        metadata: null,
        serverTime,
      });

      // 10. Enqueue webhook
      await enqueueWebhookEvent(trx, "booking.created", input.ledgerId, {
        booking: serializeBooking(bkg, [alloc]),
      });

      return { booking: bkg, allocations: [alloc], serverTime };
    });
  },
});
