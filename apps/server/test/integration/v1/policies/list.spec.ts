import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createPolicy } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/policies", () => {
  it("returns empty array when no policies exist", async () => {
    const { ledger } = await createLedger();

    const response = await client.get(`/v1/ledgers/${ledger.id}/policies`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy[] };
    expect(data).toEqual([]);
  });

  it("returns all policies for a ledger", async () => {
    const { ledger } = await createLedger();
    await createPolicy({ ledgerId: ledger.id });
    await createPolicy({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/policies`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy[] };
    expect(data).toHaveLength(2);
  });
});
