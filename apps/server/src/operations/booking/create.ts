import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { booking } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { enqueueWebhookEvent } from "infra/webhooks";
import { serializeBooking } from "routes/v1/serializers";
import { evaluatePolicy, type PolicyConfig } from "domain/policy/evaluate";

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
        .forUpdate()
        .executeTakeFirst();

      if (!resource) {
        throw new NotFoundError("Resource not found");
      }

      // 2. Capture server time
      const serverTime = await getServerTime(trx);

      // 3. Load service
      const svc = await trx
        .selectFrom("services")
        .selectAll()
        .where("id", "=", input.serviceId)
        .executeTakeFirst();

      if (!svc) {
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
      if (svc.policyId) {
        const policy = await trx
          .selectFrom("policies")
          .selectAll()
          .where("id", "=", svc.policyId)
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

          // Use policy hold_duration if configured
          const policyConfig = policy.config as Record<string, unknown>;
          if (
            policyConfig["hold_duration_ms"] &&
            typeof policyConfig["hold_duration_ms"] === "number"
          ) {
            holdDurationMs = policyConfig["hold_duration_ms"];
          }
        }
      }

      // 6. Conflict check: active, non-expired, overlapping allocations
      const conflicting = await trx
        .selectFrom("allocations")
        .select(["id", "startAt", "endAt"])
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

      // 7. Compute expiresAt
      const isHold = input.status === "hold";
      const expiresAt = isHold ? new Date(serverTime.getTime() + holdDurationMs) : null;

      // 8. Insert booking
      const bkg = await trx
        .insertInto("bookings")
        .values({
          id: generateId("bkg"),
          ledgerId: input.ledgerId,
          serviceId: input.serviceId,
          status: input.status,
          expiresAt,
          metadata: input.metadata ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 9. Insert allocation
      const alloc = await trx
        .insertInto("allocations")
        .values({
          id: generateId("alc"),
          ledgerId: input.ledgerId,
          resourceId: input.resourceId,
          bookingId: bkg.id,
          active: true,
          startAt: input.startAt,
          endAt: input.endAt,
          expiresAt,
          metadata: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 10. Enqueue webhook
      await enqueueWebhookEvent(trx, "booking.created", input.ledgerId, {
        booking: serializeBooking(bkg, [alloc]),
      });

      return { booking: bkg, allocations: [alloc], serverTime };
    });
  },
});
