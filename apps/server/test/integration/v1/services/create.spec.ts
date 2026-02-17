import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createPolicy } from "../../setup/factories";
import type { Service } from "@floyd-run/schema/types";

describe("POST /v1/ledgers/:ledgerId/services", () => {
  it("returns 201 for valid service", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Haircut",
      resourceIds: [resource.id],
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.id).toMatch(/^svc_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.name).toBe("Haircut");
    expect(data.policyId).toBeNull();
    expect(data.resourceIds).toEqual([resource.id]);
    expect(data.metadata).toEqual({});
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 201 with no resources", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Empty Service",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.resourceIds).toEqual([]);
  });

  it("returns 201 with policyId", async () => {
    const { ledger } = await createLedger();
    const { policy } = await createPolicy({ ledgerId: ledger.id });
    const { resource } = await createResource({ ledgerId: ledger.id });

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Guided Tour",
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.policyId).toBe(policy.id);
  });

  it("returns 201 with metadata", async () => {
    const { ledger } = await createLedger();
    const metadata = { duration: 60, category: "wellness" };

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Massage",
      metadata,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.metadata).toEqual(metadata);
  });

  it("returns 201 with multiple resources", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id });

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Multi-Resource Service",
      resourceIds: [r1.id, r2.id],
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.resourceIds).toHaveLength(2);
    expect(data.resourceIds).toContain(r1.id);
    expect(data.resourceIds).toContain(r2.id);
  });

  it("returns 201 with null name when not provided", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {});

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Service };
    expect(data.name).toBeNull();
  });

  it("returns 404 for non-existent policyId", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Test",
      policyId: "pol_00000000000000000000000000",
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for non-existent resourceId", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/services`, {
      name: "Test",
      resourceIds: ["rsc_00000000000000000000000000"],
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for resource from different ledger", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger2.id });

    const response = await client.post(`/v1/ledgers/${ledger1.id}/services`, {
      name: "Test",
      resourceIds: [resource.id],
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for policy from different ledger", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { policy } = await createPolicy(); // creates its own ledger

    const response = await client.post(`/v1/ledgers/${ledger1.id}/services`, {
      name: "Test",
      policyId: policy.id,
    });

    expect(response.status).toBe(404);
  });
});
