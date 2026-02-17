import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createPolicy } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/policies/:id", () => {
  it("returns 200 for existing policy", async () => {
    const { policy, ledgerId } = await createPolicy();

    const response = await client.get(`/v1/ledgers/${ledgerId}/policies/${policy.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy };
    expect(data.id).toBe(policy.id);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.currentVersionId).toMatch(/^pvr_/);
    expect(data.config).toBeDefined();
    expect(data.configSource).toBeDefined();
    expect(data.configHash).toBeDefined();
    expect(data.name).toBeNull();
    expect(data.description).toBeNull();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 404 for non-existent policy", async () => {
    const { ledger } = await createLedger();

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/policies/pol_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });
});
