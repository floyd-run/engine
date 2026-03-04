import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService, createPolicy } from "../../setup/factories";
import type { Booking, Allocation } from "@floyd-run/schema/types";
import { db } from "database";

describe("POST /v1/ledgers/:ledgerId/bookings/:id/reschedule", () => {
  async function createHoldBooking(ledgerId: string) {
    const { resource } = await createResource({ ledgerId });
    const { policy } = await createPolicy({
      ledgerId,
      config: { schema_version: 1, default_availability: "open", constraints: {} },
    });
    const { service } = await createService({
      ledgerId,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledgerId}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "hold",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };
    return { booking: data, resource, service, policy };
  }

  it("returns 200 when rescheduling a hold booking", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data, meta } = (await response.json()) as {
      data: Booking;
      meta: { serverTime: string };
    };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("hold");
    expect(data.expiresAt).not.toBeNull();
    expect(meta.serverTime).toBeDefined();

    // Should have 2 allocations: old (inactive) + new (active)
    expect(data.allocations).toHaveLength(2);
    const activeAlloc = data.allocations.find((a) => a.active);
    const inactiveAlloc = data.allocations.find((a) => !a.active);
    expect(activeAlloc).toBeDefined();
    expect(inactiveAlloc).toBeDefined();
    expect(activeAlloc!.startTime).toBe("2026-06-01T14:00:00.000Z");
    expect(activeAlloc!.endTime).toBe("2026-06-01T15:00:00.000Z");
    expect(inactiveAlloc!.startTime).toBe("2026-06-01T10:00:00.000Z");
    expect(inactiveAlloc!.endTime).toBe("2026-06-01T11:00:00.000Z");
  });

  it("returns 200 when rescheduling a confirmed booking", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    // Confirm first
    const confirmResp = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
    );
    expect(confirmResp.status).toBe(200);

    // Reschedule
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("confirmed");
    expect(data.expiresAt).toBeNull();

    const activeAlloc = data.allocations.find((a) => a.active);
    expect(activeAlloc).toBeDefined();
    expect(activeAlloc!.startTime).toBe("2026-06-01T14:00:00.000Z");
  });

  it("creates booking.rescheduled event in outbox", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };

    const event = await db
      .selectFrom("outboxEvents")
      .selectAll()
      .where("ledgerId", "=", ledger.id)
      .where("eventType", "=", "booking.rescheduled")
      .executeTakeFirst();

    expect(event).toBeDefined();
    expect(event?.eventType).toBe("booking.rescheduled");
    expect(event?.ledgerId).toBe(ledger.id);
    expect(event?.publishedAt).toBeNull();
    expect(event?.publishAttempts).toBe(0);

    const payload = event?.payload as {
      id: string;
      type: string;
      data: { booking: Booking; previousAllocations: Allocation[] };
    };
    expect(payload.type).toBe("booking.rescheduled");
    expect(payload.data.booking.id).toBe(data.id);
    expect(payload.data.previousAllocations).toHaveLength(1);
    expect(payload.data.previousAllocations[0]!.startTime).toBe("2026-06-01T10:00:00.000Z");
  });

  it("re-evaluates policy and rejects invalid new time", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: {
        schema_version: 1,
        default_availability: "open",
        constraints: {
          duration: { min_ms: 3600000, max_ms: 3600000 },
        },
      },
    });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    // Create a 1-hour booking (valid)
    const createResp = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "hold",
    });
    expect(createResp.status).toBe(201);
    const { data: booking } = (await createResp.json()) as { data: Booking };

    // Try to reschedule to 30 minutes (invalid duration)
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${booking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T14:30:00.000Z",
      },
    );

    expect(response.status).toBe(409);
  });

  it("updates policyVersionId to current version", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking, policy } = await createHoldBooking(ledger.id);

    const originalPolicyVersionId = holdBooking.policyVersionId;

    // Update the policy (creates new version)
    await client.put(`/v1/ledgers/${ledger.id}/policies/${policy.id}`, {
      name: "Updated Policy",
      config: { schema_version: 1, default_availability: "open", constraints: {} },
    });

    // Reschedule
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.policyVersionId).not.toBe(originalPolicyVersionId);
  });

  it("returns 409 when rescheduling a canceled booking", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    // Cancel first
    await client.post(`/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(409);
  });

  it("returns 404 for non-existent booking", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/bkg_00000000000000000000000000/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 when endTime is before startTime", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T15:00:00.000Z",
        endTime: "2026-06-01T14:00:00.000Z",
      },
    );

    expect(response.status).toBe(422);
  });

  it("returns 409 when new time conflicts with another booking", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: { schema_version: 1, default_availability: "open", constraints: {} },
    });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    // Create booking A at 10:00-11:00
    const respA = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "confirmed",
    });
    expect(respA.status).toBe(201);
    const { data: bookingA } = (await respA.json()) as { data: Booking };

    // Create booking B at 14:00-15:00
    const respB = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T14:00:00.000Z",
      endTime: "2026-06-01T15:00:00.000Z",
      status: "confirmed",
    });
    expect(respB.status).toBe(201);

    // Reschedule A to overlap with B
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${bookingA.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(409);
  });

  it("does not conflict with its own current allocation", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    // Reschedule to overlapping time (shift 30 min later)
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T10:30:00.000Z",
        endTime: "2026-06-01T11:30:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    const activeAlloc = data.allocations.find((a) => a.active);
    expect(activeAlloc!.startTime).toBe("2026-06-01T10:30:00.000Z");
    expect(activeAlloc!.endTime).toBe("2026-06-01T11:30:00.000Z");
  });

  it("frees original time slot after reschedule", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: { schema_version: 1, default_availability: "open", constraints: {} },
    });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    // Create booking A at 10:00-11:00
    const respA = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "confirmed",
    });
    expect(respA.status).toBe(201);
    const { data: bookingA } = (await respA.json()) as { data: Booking };

    // Reschedule A to 14:00-15:00
    const rescheduleResp = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${bookingA.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );
    expect(rescheduleResp.status).toBe(200);

    // Create booking B at 10:00-11:00 (should succeed, slot is free)
    const respB = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "confirmed",
    });
    expect(respB.status).toBe(201);
  });

  it("preserves booking identity after reschedule", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      {
        startTime: "2026-06-01T14:00:00.000Z",
        endTime: "2026-06-01T15:00:00.000Z",
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.id).toBe(holdBooking.id);
    expect(data.serviceId).toBe(holdBooking.serviceId);
    expect(data.ledgerId).toBe(holdBooking.ledgerId);
  });

  it("handles Idempotency-Key header", async () => {
    const { ledger } = await createLedger();
    const { booking: holdBooking } = await createHoldBooking(ledger.id);

    const body = {
      startTime: "2026-06-01T14:00:00.000Z",
      endTime: "2026-06-01T15:00:00.000Z",
    };

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      body,
      { headers: { "Idempotency-Key": "test-reschedule-idem-123" } },
    );

    expect(response.status).toBe(200);

    // Second request with same key returns cached response
    const response2 = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/reschedule`,
      body,
      { headers: { "Idempotency-Key": "test-reschedule-idem-123" } },
    );

    expect(response2.status).toBe(200);
  });
});
