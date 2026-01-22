import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createResource } from "../../setup/factories";
import type { Allocation } from "@floyd-run/schema/types";

interface ApiResponse {
  data: Allocation;
  meta?: { serverTime: string };
  error?: { code: string };
}

describe("POST /v1/workspaces/:workspaceId/allocations/:id/cancel", () => {
  it("cancels a hold allocation", async () => {
    const { resource, workspaceId } = await createResource();

    // Create a hold
    const createResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "hold",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    expect(createResponse.status).toBe(201);
    const { data: hold } = (await createResponse.json()) as ApiResponse;

    // Cancel it
    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${hold.id}/cancel`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse;
    expect(body.data.status).toBe("cancelled");
    expect(body.meta?.serverTime).toBeDefined();
  });

  it("cancels a confirmed allocation", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "confirmed" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/cancel`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse;
    expect(body.data.status).toBe("cancelled");
  });

  it("is idempotent - cancelling already cancelled allocation succeeds", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "cancelled" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/cancel`,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse;
    expect(body.data.status).toBe("cancelled");
  });

  it("returns 409 when cancelling expired allocation", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "expired" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/cancel`,
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiResponse;
    expect(body.error?.code).toBe("invalid_state_transition");
  });

  it("frees up the time slot after cancellation", async () => {
    const { resource, workspaceId } = await createResource();
    const startAt = new Date("2026-02-01T10:00:00Z");
    const endAt = new Date("2026-02-01T11:00:00Z");

    // Create and confirm an allocation
    const createResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "confirmed",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });
    expect(createResponse.status).toBe(201);
    const { data: first } = (await createResponse.json()) as ApiResponse;

    // Cancel it
    const cancelResponse = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${first.id}/cancel`,
    );
    expect(cancelResponse.status).toBe(200);

    // Now we should be able to book the same time slot
    const newResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "confirmed",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    });

    expect(newResponse.status).toBe(201);
  });

  it("returns 404 for non-existent allocation", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/alloc_00000000000000000000000000/cancel`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for invalid allocation ID", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/invalid-id/cancel`,
    );

    expect(response.status).toBe(422);
  });
});
