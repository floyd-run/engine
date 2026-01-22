import { createResource, createWorkspace } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import type { Resource } from "@floyd-run/schema/types";

describe("GET /v1/workspaces/:workspaceId/resources/:id", () => {
  it("returns 422 for invalid resource id", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(`/v1/workspaces/${workspace.id}/resources/invalid-id`);
    expect(response.status).toBe(422);
  });

  it("returns 200 with resource data", async () => {
    const { resource, workspaceId } = await createResource();

    const response = await client.get(`/v1/workspaces/${workspaceId}/resources/${resource.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Resource };
    expect(data.id).toBe(resource.id);
    expect(data.workspaceId).toBe(workspaceId);
    expect(data.timezone).toBe(resource.timezone);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 404 for non-existent resource", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.get(
      `/v1/workspaces/${workspace.id}/resources/res_00000000000000000000000000`,
    );
    expect(response.status).toBe(404);
  });
});
