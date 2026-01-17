import { createResource } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { Resource } from "@floyd-run/types";
import { faker } from "@faker-js/faker";

describe("GET /v1/resources/:id", () => {
  it("returns 422 for invalid resource id", async () => {
    const response = await client.get("/v1/resources/invalid-id");
    expect(response.status).toBe(422);
  });

  it("returns 200 and returns resource", async () => {
    const { resource } = await createResource();

    const response = await client.get(`/v1/resources/${resource.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Resource };
    expect(data.id).toBe(resource.id);
    expect(data.name).toBe(resource.name);
    expect(data.timezone).toBe(resource.timezone);
    expect(data.metadata).toBeDefined();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 404 for non-existent resource", async () => {
    const response = await client.get(`/v1/resources/${faker.string.uuid()}`);
    expect(response.status).toBe(404);
  });
});
