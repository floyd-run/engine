import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import { WebhookSubscription } from "../../../src/routes/v1/serializers";

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
    expect(data.eventTypes).toBeNull();
    expect(data.enabled).toBe(true);
    expect(data.secret).toMatch(/^whsec_/);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 201 with specific event types", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/webhooks`, {
      url: "https://example.com/webhook",
      eventTypes: ["allocation.created", "allocation.confirmed"],
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.eventTypes).toEqual(["allocation.created", "allocation.confirmed"]);
  });

  it("returns 201 with enabled set to false", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/webhooks`, {
      url: "https://example.com/webhook",
      enabled: false,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: WebhookSubscription };
    expect(data.enabled).toBe(false);
  });

  it("secret is only returned on creation", async () => {
    const { ledger } = await createLedger();

    const createResponse = await client.post(`/v1/ledgers/${ledger.id}/webhooks`, {
      url: "https://example.com/webhook",
    });
    expect(createResponse.status).toBe(201);
    const { data: created } = (await createResponse.json()) as {
      data: WebhookSubscription & { secret: string };
    };
    expect(created.secret).toBeDefined();

    // Get should not include secret
    const getResponse = await client.get(`/v1/ledgers/${ledger.id}/webhooks/${created.id}`);
    expect(getResponse.status).toBe(200);
    const { data: fetched } = (await getResponse.json()) as { data: WebhookSubscription };
    expect((fetched as { secret?: string }).secret).toBeUndefined();
  });
});
