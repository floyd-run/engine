import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createWebhookSubscription } from "../../setup/factories";
import { WebhookSubscription } from "../../../src/routes/v1/serializers";

describe("GET /v1/ledgers/:ledgerId/webhooks", () => {
  it("returns empty array when no webhooks exist", async () => {
    const { ledger } = await createLedger();

    const response = await client.get(`/v1/ledgers/${ledger.id}/webhooks`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription[] };
    expect(data).toEqual([]);
  });

  it("returns all webhooks for ledger", async () => {
    const { ledger } = await createLedger();
    await createWebhookSubscription({ ledgerId: ledger.id, url: "https://example.com/hook1" });
    await createWebhookSubscription({ ledgerId: ledger.id, url: "https://example.com/hook2" });

    const response = await client.get(`/v1/ledgers/${ledger.id}/webhooks`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription[] };
    expect(data).toHaveLength(2);
  });

  it("does not return webhooks from other ledgers", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();
    await createWebhookSubscription({ ledgerId: ledger1.id });
    await createWebhookSubscription({ ledgerId: ledger2.id });

    const response = await client.get(`/v1/ledgers/${ledger1.id}/webhooks`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.ledgerId).toBe(ledger1.id);
  });

  it("returns webhooks ordered by createdAt desc", async () => {
    const { ledger } = await createLedger();
    const { subscription: first } = await createWebhookSubscription({ ledgerId: ledger.id });
    const { subscription: second } = await createWebhookSubscription({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/webhooks`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: WebhookSubscription[] };
    expect(data[0]!.id).toBe(second.id);
    expect(data[1]!.id).toBe(first.id);
  });
});
