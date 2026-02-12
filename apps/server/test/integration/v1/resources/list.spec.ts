import { createResource, createLedger } from "../../setup/factories";
import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import type { ListResponse } from "../../setup/types";
import type { Resource } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/resources", () => {
  it("returns 200 with empty array when no resources", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as ListResponse<Resource>;
    expect(data).toEqual([]);
  });

  it("returns resources for the ledger", async () => {
    const { ledger } = await createLedger();
    const { resource: res1 } = await createResource({ ledgerId: ledger.id });
    const { resource: res2 } = await createResource({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as ListResponse<Resource>;
    expect(data.length).toBe(2);

    const ids = data.map((r) => r.id);
    expect(ids).toContain(res1.id);
    expect(ids).toContain(res2.id);
  });

  it("does not return resources from other ledgers", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger1.id });
    await createResource({ ledgerId: ledger2.id });

    const response = await client.get(`/v1/ledgers/${ledger1.id}/resources`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as ListResponse<Resource>;
    expect(data.length).toBe(1);
    expect(data[0]!.id).toBe(resource.id);
  });
});
