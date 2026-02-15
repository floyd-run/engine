import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { WebhookSubscription } from "routes/v1/serializers";

describe("POST /v1/ledgers/:ledgerId/webhooks", () => {
  it("returns 201 for valid webhook subscription", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/webhooks`, {
      url: "https://example.com/webhook",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: WebhookSubscription & { secret: string } };
    expect(data.id).toMatch(/^whs_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.url).toBe("https://example.com/webhook");
    expect(data.secret).toMatch(/^whsec_/);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 422 for invalid url", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/webhooks`, {
      url: "not-a-url",
    });

    expect(response.status).toBe(422);
  });
});
