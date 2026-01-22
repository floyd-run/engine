import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createResource } from "../../setup/factories";
import { Allocation } from "@floyd-run/types";

describe("POST /v1/workspaces/:workspaceId/allocations/:id/confirm", () => {
  it("confirms a hold allocation", async () => {
    const { resource, workspaceId } = await createResource();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Create a hold
    const createResponse = await client.post(`/v1/workspaces/${workspaceId}/allocations`, {
      resourceId: resource.id,
      status: "hold",
      startAt: new Date("2026-02-01T10:00:00Z").toISOString(),
      endAt: new Date("2026-02-01T11:00:00Z").toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    expect(createResponse.status).toBe(201);
    const { data: hold } = (await createResponse.json()) as { data: Allocation };

    // Confirm it
    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${hold.id}/confirm`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("confirmed");
    expect(body.meta.serverTime).toBeDefined();
  });

  it("is idempotent - confirming already confirmed allocation succeeds", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "confirmed" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/confirm`,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.status).toBe("confirmed");
  });

  it("returns 409 when confirming cancelled allocation", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "cancelled" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/confirm`,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_state_transition");
  });

  it("returns 409 when confirming expired allocation", async () => {
    const { allocation, workspaceId } = await createAllocation({ status: "expired" });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/confirm`,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_state_transition");
  });

  it("returns 409 when confirming hold that has expired (TTL)", async () => {
    const { allocation, workspaceId } = await createAllocation({
      status: "hold",
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/${allocation.id}/confirm`,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("hold_expired");
  });

  it("returns 404 for non-existent allocation", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/alloc_00000000000000000000000000/confirm`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for invalid allocation ID", async () => {
    const { workspaceId } = await createResource();

    const response = await client.post(
      `/v1/workspaces/${workspaceId}/allocations/invalid-id/confirm`,
    );

    expect(response.status).toBe(422);
  });
});
