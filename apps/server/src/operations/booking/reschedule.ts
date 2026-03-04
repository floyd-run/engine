import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { bookingInput } from "@floyd-run/schema/inputs";
import { ConflictError, NotFoundError } from "lib/errors";
import { emitEvent } from "infra/event-bus";
import { serializeBooking, serializeAllocation } from "routes/v1/serializers";
import { evaluatePolicy, type PolicyConfig } from "domain/policy/evaluate";
import { insertAllocation } from "../allocation/internal/insert";

const DEFAULT_HOLD_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export default createOperation({
  input: bookingInput.reschedule,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock booking row
      const existing = await trx
        .selectFrom("bookings")
        .selectAll()
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Booking not found");
      }

      // 2. Capture server time
      const serverTime = await getServerTime(trx);

      // 3. Validate state
      if (existing.status !== "hold" && existing.status !== "confirmed") {
        throw new ConflictError("booking.invalid_transition", {
          currentStatus: existing.status,
          requestedAction: "reschedule",
        });
      }

      // 4. Check hold expiry
      if (existing.status === "hold" && existing.expiresAt && serverTime >= existing.expiresAt) {
        throw new ConflictError("booking.hold_expired", {
          expiresAt: existing.expiresAt,
          serverTime,
        });
      }

      // 5. Snapshot current active allocations (for event payload) and derive resourceId
      const previousAllocations = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("bookingId", "=", existing.id)
        .where("active", "=", true)
        .execute();

      const resourceId = previousAllocations[0]!.resourceId;

      // 6. Lock resource row (serializes concurrent allocation writes)
      const resource = await trx
        .selectFrom("resources")
        .selectAll()
        .where("id", "=", resourceId)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      // 7. Load service + current policy version
      const service = await trx
        .selectFrom("services")
        .selectAll()
        .where("id", "=", existing.serviceId)
        .where("ledgerId", "=", input.ledgerId)
        .executeTakeFirst();

      if (!service) {
        throw new NotFoundError("Service not found");
      }

      if (!service.policyId) {
        throw new ConflictError("service.no_policy", {
          message: "Service must have a policy to reschedule bookings",
        });
      }

      const policyRow = await trx
        .selectFrom("policies")
        .select("currentVersionId")
        .where("id", "=", service.policyId)
        .executeTakeFirstOrThrow();

      const version = await trx
        .selectFrom("policyVersions")
        .selectAll()
        .where("id", "=", policyRow.currentVersionId)
        .executeTakeFirstOrThrow();

      // 8. Evaluate policy against new times
      const result = evaluatePolicy(
        version.config as unknown as PolicyConfig,
        { startTime: input.startTime, endTime: input.endTime },
        { decisionTime: serverTime, timezone: resource.timezone },
      );

      if (!result.allowed) {
        throw new ConflictError("policy.rejected", {
          code: result.code,
          message: result.message,
          ...("details" in result ? { details: result.details } : {}),
        });
      }

      const startTime = result.effectiveStartTime;
      const endTime = result.effectiveEndTime;
      const bufferBeforeMs = result.bufferBeforeMs;
      const bufferAfterMs = result.bufferAfterMs;

      let holdDurationMs = DEFAULT_HOLD_DURATION_MS;
      if (result.resolvedConfig.hold?.duration_ms !== undefined) {
        holdDurationMs = result.resolvedConfig.hold.duration_ms;
      }

      // 9. Compute new expiresAt
      const isHold = existing.status === "hold";
      const expiresAt = isHold ? new Date(serverTime.getTime() + holdDurationMs) : null;

      // 10. Deactivate old allocations
      await trx
        .updateTable("allocations")
        .set({ active: false, expiresAt: null, updatedAt: serverTime })
        .where("bookingId", "=", existing.id)
        .where("active", "=", true)
        .execute();

      // 11. Insert new allocation (conflict check runs against other allocations only)
      await insertAllocation(trx, {
        ledgerId: input.ledgerId,
        resourceId,
        bookingId: existing.id,
        startTime,
        endTime,
        bufferBeforeMs,
        bufferAfterMs,
        expiresAt,
        metadata: {},
        serverTime,
      });

      // 12. Update booking
      const booking = await trx
        .updateTable("bookings")
        .set({
          policyVersionId: version.id,
          expiresAt,
          updatedAt: serverTime,
        })
        .where("id", "=", existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 13. Fetch all allocations for response
      const allocations = await trx
        .selectFrom("allocations")
        .selectAll()
        .where("bookingId", "=", existing.id)
        .execute();

      // 14. Emit event
      await emitEvent(trx, "booking.rescheduled", booking.ledgerId, {
        booking: serializeBooking(booking, allocations),
        previousAllocations: previousAllocations.map((a) => serializeAllocation(a)),
      });

      return { booking, allocations, serverTime };
    });
  },
});
