import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";

describe("POST /v1/workspaces", () => {
  it("returns 201 for valid input", async () => {
    const response = await client.post("/v1/workspaces", {
      description: "Test description",
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toMatch(/^ws_/);
    expect(body.data.description).toBe("Test description");
  });

  it("returns 201 with null description", async () => {
    const response = await client.post("/v1/workspaces", {});

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.id).toMatch(/^ws_/);
    expect(body.data.description).toBeNull();
  });
});
