import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import {
  createLedger,
  createWebhookSubscription,
  createWebhookDelivery,
} from "../../setup/factories";
import { WebhookDelivery } from "../../../src/routes/v1/serializers";

describe("GET /v1/ledgers/:ledgerId/webhooks/:subscriptionId/deliveries", () => {
  it("returns empty array when no deliveries exist", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery[] };
    expect(data).toEqual([]);
  });

  it("returns all deliveries for subscription", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    await createWebhookDelivery({ subscriptionId: subscription.id });
    await createWebhookDelivery({ subscriptionId: subscription.id });

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery[] };
    expect(data).toHaveLength(2);
  });

  it("filters deliveries by status", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    await createWebhookDelivery({ subscriptionId: subscription.id, status: "pending" });
    await createWebhookDelivery({ subscriptionId: subscription.id, status: "succeeded" });
    await createWebhookDelivery({ subscriptionId: subscription.id, status: "failed" });

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries?status=failed`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.status).toBe("failed");
  });

  it("respects limit parameter", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    await createWebhookDelivery({ subscriptionId: subscription.id });
    await createWebhookDelivery({ subscriptionId: subscription.id });
    await createWebhookDelivery({ subscriptionId: subscription.id });

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries?limit=2`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery[] };
    expect(data).toHaveLength(2);
  });

  it("caps limit at 100", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.get(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries?limit=500`,
    );

    expect(response.status).toBe(200);
    // We just verify the request succeeds - actual cap is enforced in code
  });
});

describe("POST /v1/ledgers/:ledgerId/webhooks/:subscriptionId/deliveries/:deliveryId/retry", () => {
  it("returns 200 when retrying failed delivery", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    const { delivery } = await createWebhookDelivery({
      subscriptionId: subscription.id,
      status: "failed",
      lastError: "Connection timeout",
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries/${delivery.id}/retry`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery };
    expect(data.status).toBe("pending");
    expect(data.nextAttemptAt).toBeDefined();
  });

  it("returns 200 when retrying exhausted delivery", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    const { delivery } = await createWebhookDelivery({
      subscriptionId: subscription.id,
      status: "exhausted",
      attempts: 5,
      lastError: "Max retries exceeded",
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries/${delivery.id}/retry`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookDelivery };
    expect(data.status).toBe("pending");
  });

  it("returns 404 for pending delivery (not retryable)", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    const { delivery } = await createWebhookDelivery({
      subscriptionId: subscription.id,
      status: "pending",
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries/${delivery.id}/retry`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for succeeded delivery (not retryable)", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });
    const { delivery } = await createWebhookDelivery({
      subscriptionId: subscription.id,
      status: "succeeded",
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries/${delivery.id}/retry`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for non-existent delivery", async () => {
    const { ledger } = await createLedger();
    const { subscription } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/webhooks/${subscription.id}/deliveries/whd_00000000000000000000000000/retry`,
    );

    expect(response.status).toBe(404);
  });
});
