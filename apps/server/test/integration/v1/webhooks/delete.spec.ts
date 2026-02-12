import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";

describe("DELETE /v1/ledgers/:ledgerId/webhooks/:subscriptionId", () => {
  it("returns 204 when deleting existing webhook", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`);

    expect(response.status).toBe(204);

    // Verify it's deleted by listing
    const listResponse = await client.get(`/v1/ledgers/${ledger.id}/webhooks`);
    const { data } = (await listResponse.json()) as { data: { id: string }[] };
    expect(data.find((w) => w.id === subscription.id)).toBeUndefined();
  });

  it("returns 404 for non-existent webhook", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(
      `/v1/ledgers/${ledger.id}/webhooks/whs_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });
});
