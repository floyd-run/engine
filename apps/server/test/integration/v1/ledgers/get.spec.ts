import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { LedgerResponse } from "../../setup/types";

describe("GET /v1/ledgers/:id", () => {
  it("returns 422 for invalid ledger id", async () => {
    const response = await client.get("/v1/ledgers/invalid-id");
    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent ledger", async () => {
    const response = await client.get("/v1/ledgers/ldg_00000000000000000000000000");
    expect(response.status).toBe(404);
  });

  it("returns 200 with ledger data", async () => {
    const { ledger } = await createLedger();

    const response = await client.get(`/v1/ledgers/${ledger.id}`);
    expect(response.status).toBe(200);

    const { data } = (await response.json()) as LedgerResponse;
    expect(data.id).toBe(ledger.id);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
