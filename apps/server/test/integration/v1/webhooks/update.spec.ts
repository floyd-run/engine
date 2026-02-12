import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";
import { WebhookSubscription } from "routes/v1/serializers";

describe("PATCH /v1/ledgers/:ledgerId/webhooks/:subscriptionId", () => {
  it("returns 200 when updating url", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.patch(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`, {
      url: "https://new-url.com/webhook",
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.url).toBe("https://new-url.com/webhook");
  });

  it("returns 404 for non-existent webhook", async () => {
    const { ledger } = await createLedger();

    const response = await client.patch(
      `/v1/ledgers/${ledger.id}/webhooks/whs_00000000000000000000000000`,
      { url: "https://new-url.com/webhook" },
    );

    expect(response.status).toBe(404);
  });
});
