import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import {
  createLedger,
  createPolicy,
  createService,
  createResource,
  createBooking,
} from "../../setup/factories";
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

  it("returns 409 when policy is referenced by a service", async () => {
    const { ledger } = await createLedger();
    const { policy } = await createPolicy({ ledgerId: ledger.id });
    await createService({ ledgerId: ledger.id, policyId: policy.id });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/policies/${policy.id}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("policy.in_use");
  });

  it("returns 409 when policy version is referenced by a booking", async () => {
    const { ledger } = await createLedger();
    const { policy, version } = await createPolicy({ ledgerId: ledger.id });
    const { resource } = await createResource({ ledgerId: ledger.id });
    await createBooking({
      ledgerId: ledger.id,
      resourceId: resource.id,
      policyVersionId: version.id,
    });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/policies/${policy.id}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("policy.in_use");
  });
});
