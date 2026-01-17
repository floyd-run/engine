import { createResource } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { Resource } from "@floyd-run/types";

describe("GET /v1/resources", () => {
  it("returns resources including the created one", async () => {
    const { resource } = await createResource();

    const response = await client.get("/v1/resources");

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Array<Resource> };
    expect(Array.isArray(data)).toBe(true);

    const found = data.find((r) => r.id === resource.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(resource.name);
  });
});
