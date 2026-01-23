import { createResource, createLedger } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import type { ResourceResponse } from "../../setup/types";

describe("GET /v1/ledgers/:ledgerId/resources/:id", () => {
  it("returns 422 for invalid resource id", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/resources/invalid-id`);
    expect(response.status).toBe(422);
  });

  it("returns 200 with resource data", async () => {
    const { resource, ledgerId } = await createResource();

    const response = await client.get(`/v1/ledgers/${ledgerId}/resources/${resource.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.id).toBe(resource.id);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.timezone).toBe(resource.timezone);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 404 for non-existent resource", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(
      `/v1/ledgers/${ledger.id}/resources/rsc_00000000000000000000000000`,
    );
    expect(response.status).toBe(404);
  });
});
