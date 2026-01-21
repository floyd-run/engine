import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";

describe("POST /v1/workspaces", () => {
  it("returns 422 for invalid input", async () => {
    const response = await client.post("/v1/workspaces", {});
    expect(response.status).toBe(422);
  });

  it("returns 422 for empty workspaceId", async () => {
    const response = await client.post("/v1/workspaces", {
      workspaceId: "",
    });
    expect(response.status).toBe(422);
  });

  it("returns 201 for valid input", async () => {
    const response = await client.post("/v1/workspaces", {
      workspaceId: "test-workspace",
      description: "Test description",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.workspaceId).toBe("test-workspace");
    expect(body.data.description).toBe("Test description");
  });

  it("returns 201 with null description", async () => {
    const response = await client.post("/v1/workspaces", {
      workspaceId: "test-workspace-2",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.workspaceId).toBe("test-workspace-2");
    expect(body.data.description).toBeNull();
  });
});
