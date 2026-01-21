import { createResource, createWorkspace } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { Resource } from "@floyd-run/types";

describe("GET /v1/workspaces/:workspaceId/resources", () => {
  it("returns 200 with empty array when no resources", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(`/v1/workspaces/${workspace.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Array<Resource> };
    expect(data).toEqual([]);
  });

  it("returns resources for the workspace", async () => {
    const { workspace } = await createWorkspace();
    const { resource: res1 } = await createResource({ workspaceId: workspace.id });
    const { resource: res2 } = await createResource({ workspaceId: workspace.id });

    const response = await client.get(`/v1/workspaces/${workspace.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Array<Resource> };
    expect(data.length).toBe(2);

    const ids = data.map((r) => r.id);
    expect(ids).toContain(res1.id);
    expect(ids).toContain(res2.id);
  });

  it("does not return resources from other workspaces", async () => {
    const { workspace: ws1 } = await createWorkspace();
    const { workspace: ws2 } = await createWorkspace();
    const { resource } = await createResource({ workspaceId: ws1.id });
    await createResource({ workspaceId: ws2.id });

    const response = await client.get(`/v1/workspaces/${ws1.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Array<Resource> };
    expect(data.length).toBe(1);
    expect(data[0].id).toBe(resource.id);
  });
});
