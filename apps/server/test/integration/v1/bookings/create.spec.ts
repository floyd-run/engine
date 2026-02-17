import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import {
  createLedger,
  createResource,
  createService,
  createAllocation,
  createPolicy,
} from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";
import { db } from "database";

const OPEN_POLICY_CONFIG = {
  schema_version: 1,
  default_availability: "open",
  constraints: {},
};

describe("POST /v1/ledgers/:ledgerId/bookings", () => {
  it("returns 201 for valid hold booking", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const startTime = "2026-06-01T10:00:00.000Z";
    const endTime = "2026-06-01T11:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime,
      endTime,
    });

    expect(response.status).toBe(201);
    const { data, meta } = (await response.json()) as {
      data: Booking;
      meta: { serverTime: string };
    };
    expect(data.id).toMatch(/^bkg_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.serviceId).toBe(service.id);
    expect(data.status).toBe("hold");
    expect(data.expiresAt).toBeDefined();
    expect(data.allocations).toHaveLength(1);
    expect(data.allocations[0]!.resourceId).toBe(resource.id);
    expect(data.allocations[0]!.startTime).toBe(startTime);
    expect(data.allocations[0]!.endTime).toBe(endTime);
    expect(data.allocations[0]!.active).toBe(true);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
    expect(meta.serverTime).toBeDefined();
  });

  it("returns 201 for confirmed booking", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "confirmed",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.status).toBe("confirmed");
    expect(data.expiresAt).toBeNull();
  });

  it("returns 201 with metadata", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const metadata = { customerName: "Alice", notes: "Window seat" };

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      metadata,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.metadata).toEqual(metadata);
  });

  it("creates booking.created event in outbox", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };

    // Verify event was created in outbox
    const event = await db
      .selectFrom("outboxEvents")
      .selectAll()
      .where("ledgerId", "=", ledger.id)
      .where("eventType", "=", "booking.created")
      .executeTakeFirst();

    expect(event).toBeDefined();
    expect(event?.eventType).toBe("booking.created");
    expect(event?.ledgerId).toBe(ledger.id);
    expect(event?.publishedAt).toBeNull(); // Not yet published
    expect(event?.publishAttempts).toBe(0);

    // Verify payload contains booking data
    const payload = event?.payload as { id: string; type: string; data: { booking: Booking } };
    expect(payload.type).toBe("booking.created");
    expect(payload.data.booking.id).toBe(data.id);
    expect(payload.data.booking.serviceId).toBe(service.id);
  });

  it("returns 422 for missing required fields", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {});

    expect(response.status).toBe(422);
  });

  it("returns 422 when endTime equals startTime", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      resourceIds: [resource.id],
    });
    const time = "2026-06-01T10:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: time,
      endTime: time,
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 when endTime is before startTime", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T11:00:00.000Z",
      endTime: "2026-06-01T10:00:00.000Z",
    });

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent service", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: "svc_00000000000000000000000000",
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for non-existent resource", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: "rsc_00000000000000000000000000",
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
    });

    expect(response.status).toBe(404);
  });

  it("returns 409 when service has no policy", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("service.no_policy");
  });

  it("returns 409 when resource does not belong to service", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      resourceIds: [r1.id], // only r1 is in the service
    });

    const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
      serviceId: service.id,
      resourceId: r2.id, // r2 is NOT in the service
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
    });

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("service.resource_not_member");
  });

  describe("conflict detection", () => {
    it("returns 409 when overlapping with existing active allocation", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      // Create a raw allocation blocking 10:00-11:00
      await createAllocation({
        ledgerId: ledger.id,
        resourceId: resource.id,
        active: true,
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-01T11:00:00.000Z"),
      });

      // Try to book overlapping time
      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:30:00.000Z",
        endTime: "2026-06-01T11:30:00.000Z",
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("allocation.overlap");
    });

    it("returns 409 when overlapping with existing booking", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      // Create first booking
      const first = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
        status: "confirmed",
      });
      expect(first.status).toBe(201);

      // Try to create overlapping booking
      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:30:00.000Z",
        endTime: "2026-06-01T11:30:00.000Z",
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("allocation.overlap");
    });

    it("allows adjacent bookings (no overlap)", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      const first = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
        status: "confirmed",
      });
      expect(first.status).toBe(201);

      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T11:00:00.000Z",
        endTime: "2026-06-01T12:00:00.000Z",
        status: "confirmed",
      });

      expect(response.status).toBe(201);
    });

    it("ignores inactive allocations for conflict detection", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      // Create an inactive allocation
      await createAllocation({
        ledgerId: ledger.id,
        resourceId: resource.id,
        active: false,
        startTime: new Date("2026-06-01T10:00:00.000Z"),
        endTime: new Date("2026-06-01T11:00:00.000Z"),
      });

      // Should succeed because inactive allocation doesn't block
      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
      });

      expect(response.status).toBe(201);
    });
  });

  describe("buffers", () => {
    it("stores buffer-expanded times as allocation startTime/endTime", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({
        ledgerId: ledger.id,
        config: {
          schema_version: 1,
          default_availability: "open",
          constraints: {
            buffers: { before_ms: 900_000, after_ms: 600_000 }, // 15min before, 10min after
          },
        },
      });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
        status: "confirmed",
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: Booking };
      const allocation = data.allocations[0]!;

      // Allocation startTime/endTime = buffer-expanded blocked window
      expect(allocation.startTime).toBe("2026-06-01T09:45:00.000Z"); // 10:00 - 15min
      expect(allocation.endTime).toBe("2026-06-01T11:10:00.000Z"); // 11:00 + 10min

      // Buffer amounts stored for deriving original customer time
      expect(allocation.buffer.beforeMs).toBe(900_000);
      expect(allocation.buffer.afterMs).toBe(600_000);
    });

    it("stores zero buffers when policy has no buffer config", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({ ledgerId: ledger.id, config: OPEN_POLICY_CONFIG });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      const startTime = "2026-06-01T10:00:00.000Z";
      const endTime = "2026-06-01T11:00:00.000Z";

      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime,
        endTime,
        status: "confirmed",
      });

      expect(response.status).toBe(201);
      const { data } = (await response.json()) as { data: Booking };
      const allocation = data.allocations[0]!;

      // Without buffer config, allocation times = input times (no buffers)
      expect(allocation.startTime).toBe(startTime);
      expect(allocation.endTime).toBe(endTime);
      expect(allocation.buffer.beforeMs).toBe(0);
      expect(allocation.buffer.afterMs).toBe(0);
    });

    it("detects conflicts across buffer windows", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({
        ledgerId: ledger.id,
        config: {
          schema_version: 1,
          default_availability: "open",
          constraints: {
            buffers: { before_ms: 0, after_ms: 1_800_000 }, // 30min after-buffer
          },
        },
      });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      // First booking: customer 10:00-11:00, allocation blocks until 11:30
      const first = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
        status: "confirmed",
      });
      expect(first.status).toBe(201);

      // Second booking: customer 11:00-12:00, allocation starts at 11:00
      // Conflicts because first allocation blocks until 11:30
      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T11:00:00.000Z",
        endTime: "2026-06-01T12:00:00.000Z",
        status: "confirmed",
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("allocation.overlap");
    });

    it("allows bookings outside the buffer window", async () => {
      const { ledger } = await createLedger();
      const { resource } = await createResource({ ledgerId: ledger.id });
      const { policy } = await createPolicy({
        ledgerId: ledger.id,
        config: {
          schema_version: 1,
          default_availability: "open",
          constraints: {
            buffers: { before_ms: 900_000, after_ms: 900_000 }, // 15min each side
          },
        },
      });
      const { service } = await createService({
        ledgerId: ledger.id,
        policyId: policy.id,
        resourceIds: [resource.id],
      });

      // First booking: customer 10:00-11:00, allocation 09:45-11:15
      const first = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T10:00:00.000Z",
        endTime: "2026-06-01T11:00:00.000Z",
        status: "confirmed",
      });
      expect(first.status).toBe(201);

      // Second booking: customer 11:30-12:30, allocation 11:15-12:45
      // Adjacent at 11:15 — no overlap
      const response = await client.post(`/v1/ledgers/${ledger.id}/bookings`, {
        serviceId: service.id,
        resourceId: resource.id,
        startTime: "2026-06-01T11:30:00.000Z",
        endTime: "2026-06-01T12:30:00.000Z",
        status: "confirmed",
      });

      expect(response.status).toBe(201);
    });
  });
});
