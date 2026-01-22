import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createResource } from "../../setup/factories";
import { Allocation } from "@floyd-run/types";

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
    expect(data.version).toBe(1);
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

  it("returns 422 for missing required fields", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      status: "confirmed",
    });

    expect(response.status).toBe(422);
  });
});
