import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createWorkspace } from "../../setup/factories";
import type { WorkspaceResponse } from "../../setup/types";

describe("GET /v1/workspaces/:id", () => {
  it("returns 422 for invalid workspace id", async () => {
    const response = await client.get("/v1/workspaces/invalid-id");
    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent workspace", async () => {
    const response = await client.get("/v1/workspaces/ws_00000000000000000000000000");
    expect(response.status).toBe(404);
  });

  it("returns 200 with workspace data", async () => {
    const { workspace } = await createWorkspace();

    const response = await client.get(`/v1/workspaces/${workspace.id}`);
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as WorkspaceResponse;
    expect(data.id).toBe(workspace.id);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
