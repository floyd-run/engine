import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createWorkspace } from "../../setup/factories";
import { Resource } from "@floyd-run/types";

describe("POST /v1/workspaces/:workspaceId/resources", () => {
  it("returns 201 with default timezone", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.post(`/v1/workspaces/${workspace.id}/resources`, {});

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Resource };
    expect(data.id).toMatch(/^res_/);
    expect(data.workspaceId).toBe(workspace.id);
    expect(data.timezone).toBe("UTC");
  });

  it("returns 201 with custom timezone", async () => {
    const { workspace } = await createWorkspace();
    const response = await client.post(`/v1/workspaces/${workspace.id}/resources`, {
      timezone: "America/New_York",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Resource };
    expect(data.timezone).toBe("America/New_York");
  });
});
