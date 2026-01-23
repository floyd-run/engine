import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";
import { WebhookSubscription } from "../../../src/routes/v1/serializers";

describe("GET /v1/ledgers/:ledgerId/webhooks/:subscriptionId", () => {
  it("returns 200 for existing webhook", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.id).toBe(subscription.id);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.url).toBe(subscription.url);
  });

  it("returns 404 for non-existent webhook", async () => {
    const { ledger } = await createLedger();

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/whs_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("does not expose secret field", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect((data as { secret?: string }).secret).toBeUndefined();
  });
});
