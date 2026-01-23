import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";
import { WebhookSubscription } from "../../../src/routes/v1/serializers";

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

  it("returns 200 when updating eventTypes", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.patch(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`, {
      eventTypes: ["allocation.confirmed"],
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.eventTypes).toEqual(["allocation.confirmed"]);
  });

  it("returns 200 when setting eventTypes to null", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({
      ledgerId: ledger.id,
      eventTypes: ["allocation.created"],
    });

    const response = await client.patch(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`, {
      eventTypes: null,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.eventTypes).toBeNull();
  });

  it("returns 200 when disabling webhook", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.patch(`/v1/ledgers/${ledger.id}/webhooks/${subscription.id}`, {
      enabled: false,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.enabled).toBe(false);
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
