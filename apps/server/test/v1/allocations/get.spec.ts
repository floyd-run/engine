import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createWorkspace } from "../../setup/factories";
import { Allocation } from "@floyd-run/types";

describe("GET /v1/workspaces/:workspaceId/allocations/:id", () => {
  it("returns 422 for invalid allocation id", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(`/v1/workspaces/${workspace.id}/allocations/invalid-id`);

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent allocation", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(
      `/v1/workspaces/${workspace.id}/allocations/alloc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with allocation data", async () => {
    const { allocation, workspaceId, resourceId } = await createAllocation();
    const response = await client.get(`/v1/workspaces/${workspaceId}/allocations/${allocation.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.id).toBe(allocation.id);
    expect(data.workspaceId).toBe(workspaceId);
    expect(data.resourceId).toBe(resourceId);
    expect(data.status).toBe(allocation.status);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
