import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createWorkspace } from "../../setup/factories";

describe("GET /v1/workspaces", () => {
  it("returns 200 with empty array when no workspaces", async () => {
    const response = await client.get("/v1/workspaces");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
  });

  it("returns 200 with workspaces list", async () => {
    await createWorkspace({ workspaceId: "list-test-1" });
    await createWorkspace({ workspaceId: "list-test-2" });

    const response = await client.get("/v1/workspaces");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const workspaceIds = body.data.map((w: { workspaceId: string }) => w.workspaceId);
    expect(workspaceIds).toContain("list-test-1");
    expect(workspaceIds).toContain("list-test-2");
  });
});
