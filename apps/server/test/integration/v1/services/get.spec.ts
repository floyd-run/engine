import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService } from "../../setup/factories";
import type { Service } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/services/:id", () => {
  it("returns 422 for invalid service id", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/services/invalid-id`);

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent service", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(
      `/v1/ledgers/${ledger.id}/services/svc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with service data", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      name: "Test Service",
      resourceIds: [resource.id],
    });

    const response = await client.get(`/v1/ledgers/${ledger.id}/services/${service.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.id).toBe(service.id);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.name).toBe("Test Service");
    expect(data.resourceIds).toEqual([resource.id]);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns service with empty resourceIds", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/services/${service.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.resourceIds).toEqual([]);
  });
});
