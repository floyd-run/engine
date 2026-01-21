import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { Workspace } from "@floyd-run/types";

describe("POST /v1/workspaces", () => {
  it("returns 201 for valid input", async () => {
    const response = await client.post("/v1/workspaces", {});

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Workspace };
    expect(data.id).toMatch(/^ws_/);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
