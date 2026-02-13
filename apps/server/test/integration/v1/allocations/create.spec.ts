import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createResource } from "../../setup/factories";
import { Allocation } from "@floyd-run/schema/types";

describe("POST /v1/ledgers/:ledgerId/allocations", () => {
  it("returns 201 for valid allocation", async () => {
    const { resource, ledgerId } = await createResource();
    const startAt = new Date("2026-02-01T10:00:00Z");
    const endAt = new Date("2026-02-01T11:00:00Z");

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: resource.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.id).toMatch(/^alc_/);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.resourceId).toBe(resource.id);
    expect(data.active).toBe(true);
    expect(data.bookingId).toBeNull();
    expect(data.startAt).toBe(startAt.toISOString());
    expect(data.endAt).toBe(endAt.toISOString());
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 201 with expiresAt for temporary block", async () => {
    const { resource, ledgerId } = await createResource();
    const startAt = new Date("2026-02-01T10:00:00Z");
    const endAt = new Date("2026-02-01T11:00:00Z");
    const expiresAt = new Date("2026-01-25T10:00:00Z");

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: resource.id,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.expiresAt).toBe(expiresAt.toISOString());
  });

  it("returns 201 with metadata", async () => {
    const { resource, ledgerId } = await createResource();
    const metadata = { customerName: "John Doe", notes: "VIP booking" };

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: resource.id,
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      metadata,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.metadata).toEqual(metadata);
  });

  it("returns 422 for missing required fields", async () => {
    const { ledgerId } = await createResource();

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {});

    expect(response.status).toBe(422);
  });

  it("returns 422 when endAt equals startAt", async () => {
    const { resource, ledgerId } = await createResource();
    const time = new Date("2026-02-01T10:00:00Z").toISOString();

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: resource.id,
      startAt: time,
      endAt: time,
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 when endAt is before startAt", async () => {
    const { resource, ledgerId } = await createResource();

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: resource.id,
      startAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T10:00:00Z").toISOString(),
    });

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent resource", async () => {
    const { ledgerId } = await createResource();

    const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
      resourceId: "rsc_00000000000000000000000000",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(404);
  });

  describe("conflict detection", () => {
    it("returns 409 when overlapping with active allocation", async () => {
      const { resource, ledgerId } = await createResource();

      // Create first allocation: 10:00-11:00
      const first = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Try to create overlapping allocation: 10:30-11:30
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("allocation.overlap");
    });

    it("returns 409 when overlapping with non-expired temporary allocation", async () => {
      const { resource, ledgerId } = await createResource();

      // Create allocation with future expiry
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const first = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      expect(first.status).toBe(201);

      // Try to create overlapping allocation
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(409);
    });

    it("allows allocation when temporary allocation has expired", async () => {
      const { resource, ledgerId } = await createResource();

      // Create allocation that already expired
      const expiresAt = new Date(Date.now() - 1000); // 1 second ago
      const first = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      expect(first.status).toBe(201);

      // Should succeed because the previous allocation expired
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("allows adjacent allocations (no overlap)", async () => {
      const { resource, ledgerId } = await createResource();

      // Create first allocation: 10:00-11:00
      const first = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Create adjacent allocation: 11:00-12:00 (starts exactly when first ends)
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T12:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("allows allocations on different resources", async () => {
      const { resource: resource1, ledgerId } = await createResource();
      const { resource: resource2 } = await createResource({ ledgerId });

      // Create allocation on resource1
      const first = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource1.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Same time slot on resource2 should succeed
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource2.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("ignores inactive allocations for conflict detection", async () => {
      const { resource, ledgerId } = await createResource();

      // Insert an inactive allocation directly via factory
      const { createAllocation } = await import("../../setup/factories");
      await createAllocation({
        resourceId: resource.id,
        ledgerId,
        active: false,
        startAt: new Date("2026-02-01T10:00:00Z"),
        endAt: new Date("2026-02-01T11:00:00Z"),
      });

      // Should succeed because inactive allocations don't block
      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("returns meta.serverTime in response", async () => {
      const { resource, ledgerId } = await createResource();

      const response = await client.post(`/v1/ledgers/${ledgerId}/allocations`, {
        resourceId: resource.id,
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
      const body = (await response.json()) as { meta: { serverTime: string } };
      expect(body.meta.serverTime).toBeDefined();
      expect(new Date(body.meta.serverTime).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
