import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createPolicy } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";

describe("DELETE /v1/ledgers/:ledgerId/policies/:id", () => {
  it("returns 204 for successful delete", async () => {
    const { ledger } = await createLedger();
    const { policy } = await createPolicy({ ledgerId: ledger.id });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/policies/${policy.id}`);

    expect(response.status).toBe(204);

    // Verify it's deleted by listing
    const listResponse = await client.get(`/v1/ledgers/${ledger.id}/policies`);
    const { data } = (await listResponse.json()) as { data: Policy[] };
    expect(data.find((p) => p.id === policy.id)).toBeUndefined();
  });

  it("returns 404 for non-existent policy", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(
      `/v1/ledgers/${ledger.id}/policies/pol_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });
});
