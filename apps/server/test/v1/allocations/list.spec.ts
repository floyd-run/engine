import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createWorkspace } from "../../setup/factories";
import { Allocation } from "@floyd-run/schema/types";

describe("GET /v1/workspaces/:workspaceId/allocations", () => {
  it("returns 200 with empty array when no allocations", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(`/v1/workspaces/${workspace.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data).toEqual([]);
  });

  it("returns allocations for the workspace", async () => {
    const { workspace } = await createWorkspace();

    // Create two allocations for this workspace
    await createAllocation({ workspaceId: workspace.id });
    await createAllocation({ workspaceId: workspace.id });

    const response = await client.get(`/v1/workspaces/${workspace.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data.length).toBe(2);
    expect(data[0]?.workspaceId).toBe(workspace.id);
    expect(data[1]?.workspaceId).toBe(workspace.id);
  });

  it("does not return allocations from other workspaces", async () => {
    const { workspace: workspace1 } = await createWorkspace();
    const { workspace: workspace2 } = await createWorkspace();

    // Create allocation for workspace1
    await createAllocation({ workspaceId: workspace1.id });
    // Create allocation for workspace2
    await createAllocation({ workspaceId: workspace2.id });

    const response = await client.get(`/v1/workspaces/${workspace1.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data.length).toBe(1);
    expect(data[0]!.workspaceId).toBe(workspace1.id);
  });
});
