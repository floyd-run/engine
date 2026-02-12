import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { ListResponse } from "../../setup/types";
import type { Ledger } from "@floyd-run/schema/types";

describe("GET /v1/ledgers", () => {
  it("returns 200 with empty array when no ledgers", async () => {
    const response = await client.get("/v1/ledgers");
    expect(response.status).toBe(200);

    const body = (await response.json()) as ListResponse<Ledger>;
    expect(body.data).toBeInstanceOf(Array);
  });

  it("returns 200 with ledgers list", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();

    const response = await client.get("/v1/ledgers");
    expect(response.status).toBe(200);

    const body = (await response.json()) as ListResponse<Ledger>;
    expect(body.data).toBeInstanceOf(Array);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    const ids = body.data.map((w) => w.id);
    expect(ids).toContain(ledger1.id);
    expect(ids).toContain(ledger2.id);
  });
});
