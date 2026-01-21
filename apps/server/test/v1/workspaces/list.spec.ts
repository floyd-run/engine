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
    const { workspace: ws1 } = await createWorkspace();
    const { workspace: ws2 } = await createWorkspace();

    const response = await client.get("/v1/workspaces");
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const ids = body.data.map((w: { id: string }) => w.id);
    expect(ids).toContain(ws1.id);
    expect(ids).toContain(ws2.id);
  });
});
