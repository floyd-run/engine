import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import type { LedgerResponse } from "../../setup/types";

describe("POST /v1/ledgers", () => {
  it("returns 201 for valid input", async () => {
    const response = await client.post("/v1/ledgers", {});

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as LedgerResponse;
    expect(data.id).toMatch(/^ldg_/);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
