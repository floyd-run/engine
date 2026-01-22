import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createResource } from "../../setup/factories";
import { Allocation } from "@floyd-run/schema/types";

describe("POST /v1/workspaces/:workspaceId/allocations", () => {
  it("returns 201 for valid confirmed allocation", async () => {
    const { resource, workspaceId } = await createResource();
    const startAt = new Date("2026-02-01T10:00:00Z");
    const endAt = new Date("2026-02-01T11:00:00Z");

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "confirmed",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.id).toMatch(/^alloc_/);
    expect(data.workspaceId).toBe(workspaceId);
    expect(data.resourceId).toBe(resource.id);
    expect(data.status).toBe("confirmed");
    expect(data.startAt).toBe(startAt.toISOString());
    expect(data.endAt).toBe(endAt.toISOString());
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 201 for hold allocation with expiry", async () => {
    const { resource, workspaceId } = await createResource();
    const startAt = new Date("2026-02-01T10:00:00Z");
    const endAt = new Date("2026-02-01T11:00:00Z");
    const expiresAt = new Date("2026-01-25T10:00:00Z");

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "hold",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.status).toBe("hold");
    expect(data.expiresAt).toBe(expiresAt.toISOString());
  });

  it("returns 201 with metadata", async () => {
    const { resource, workspaceId } = await createResource();
    const metadata = { customerName: "John Doe", notes: "VIP booking" };

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      metadata,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.metadata).toEqual(metadata);
  });

  it("returns 422 for invalid status", async () => {
    const { resource, workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "invalid",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 for terminal status (cancelled)", async () => {
    const { resource, workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "cancelled",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 for terminal status (expired)", async () => {
    const { resource, workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "expired",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(422);
  });

  it("defaults to hold status when not specified", async () => {
    const { resource, workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.status).toBe("hold");
  });

  it("returns 422 for missing required fields", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      status: "confirmed",
    });

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent resource", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: "res_00000000000000000000000000",
      status: "confirmed",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
    });

    expect(response.status).toBe(404);
  });

  describe("conflict detection", () => {
    it("returns 409 when overlapping with confirmed allocation", async () => {
      const { resource, workspaceId } = await createResource();

      // Create first confirmed allocation: 10:00-11:00
      const first = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Try to create overlapping allocation: 10:30-11:30
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(409);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe("overlap_conflict");
    });

    it("returns 409 when overlapping with active hold", async () => {
      const { resource, workspaceId } = await createResource();

      // Create hold that expires in the future
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      const first = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "hold",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      expect(first.status).toBe(201);

      // Try to create overlapping allocation
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(409);
    });

    it("allows allocation when hold has expired", async () => {
      const { resource, workspaceId } = await createResource();

      // Create hold that already expired
      const expiresAt = new Date(Date.now() - 1000); // 1 second ago
      const first = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "hold",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      expect(first.status).toBe(201);

      // Should succeed because hold expired
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("allows adjacent allocations (no overlap)", async () => {
      const { resource, workspaceId } = await createResource();

      // Create first allocation: 10:00-11:00
      const first = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Create adjacent allocation: 11:00-12:00 (starts exactly when first ends)
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T11:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T12:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("allows allocations on different resources", async () => {
      const { resource: resource1, workspaceId } = await createResource();
      const { resource: resource2 } = await createResource({ workspaceId });

      // Create allocation on resource1
      const first = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource1.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });
      expect(first.status).toBe(201);

      // Same time slot on resource2 should succeed
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource2.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("ignores cancelled allocations for conflict detection", async () => {
      const { resource, workspaceId } = await createResource();

      // Create and then we'll pretend it's cancelled via factory
      // For this test, we use the factory to insert a cancelled allocation directly
      const { createAllocation } = await import("../../setup/factories");
      await createAllocation({
        resourceId: resource.id,
        workspaceId,
        status: "cancelled",
        startAt: new Date("2026-02-01T10:00:00Z"),
        endAt: new Date("2026-02-01T11:00:00Z"),
      });

      // Should succeed because cancelled allocations don't block
      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
        startAt: new Date("2026-02-01T10:30:00Z").toISOString(),
        endAt: new Date("2026-02-01T11:30:00Z").toISOString(),
      });

      expect(response.status).toBe(201);
    });

    it("returns meta.serverTime in response", async () => {
      const { resource, workspaceId } = await createResource();

      const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
        resourceId: resource.id,
        status: "confirmed",
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
