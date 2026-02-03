import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { ResourceResponse } from "../../setup/types";

describe("POST /v1/ledgers/:ledgerId/resources", () => {
  it("returns 201 with default timezone", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {});

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.id).toMatch(/^rsc_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.timezone).toBe("UTC");
  });

  it("returns 201 with custom timezone", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      timezone: "America/New_York",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.timezone).toBe("America/New_York");
  });
});
