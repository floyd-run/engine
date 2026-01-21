import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createWorkspace } from "../../setup/factories";

describe("GET /v1/workspaces/:workspaceId", () => {
  it("returns 404 for non-existent workspace", async () => {
    const response = await client.get("/v1/workspaces/non-existent");
    expect(response.status).toBe(404);
  });

  it("returns 200 with workspace data", async () => {
    const { workspace } = await createWorkspace({
      workspaceId: "get-test-workspace",
      description: "Test description",
    });

    const response = await client.get(`/v1/workspaces/${workspace.workspaceId}`);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data.workspaceId).toBe("get-test-workspace");
    expect(body.data.description).toBe("Test description");
    expect(body.data.createdAt).toBeDefined();
    expect(body.data.updatedAt).toBeDefined();
  });
});
