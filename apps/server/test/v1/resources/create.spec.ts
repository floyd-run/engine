import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";

describe("POST /v1/resources", () => {
  it("returns 422 for invalid input", async () => {
    const response = await client.post("/v1/resources", {});
    expect(response.status).toBe(422);
  });

  it("returns 201 for valid input", async () => {
    const response = await client.post("/v1/resources", {
      name: "Test Resource",
      timezone: "UTC",
      metadata: {},
    });

    expect(response.status).toBe(201);
  });
});
