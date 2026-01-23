import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";
import { WebhookSubscription } from "../../../src/routes/v1/serializers";

describe("POST /v1/ledgers/:ledgerId/webhooks/:subscriptionId/rotate-secret", () => {
  it("returns 200 with new secret", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    const oldSecret = subscription.secret;

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/rotate-secret`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription & { secret: string } };
    expect(data.secret).toMatch(/^whsec_/);
    expect(data.secret).not.toBe(oldSecret);
  });

  it("returns 404 for non-existent webhook", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/whs_00000000000000000000000000/rotate-secret`,
    );

    expect(response.status).toBe(404);
  });
});
