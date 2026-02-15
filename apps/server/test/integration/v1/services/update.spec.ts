import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService, createPolicy } from "../../setup/factories";
import type { Service } from "@floyd-run/schema/types";

describe("PUT /v1/ledgers/:ledgerId/services/:id", () => {
  it("returns 200 with updated service", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({ ledgerId: ledger.id, name: "Old Name" });

    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      name: "New Name",
      resourceIds: [resource.id],
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.id).toBe(service.id);
    expect(data.name).toBe("New Name");
    expect(data.resourceIds).toEqual([resource.id]);
  });

  it("replaces resourceIds on update", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id });
    const { service } = await createService({
      ledgerId: ledger.id,
      resourceIds: [r1.id],
    });

    // Verify initial state
    const getResp = await client.get(`/v1/ledgers/${ledger.id}/services/${service.id}`);
    const initial = (await getResp.json()) as { data: Service };
    expect(initial.data.resourceIds).toEqual([r1.id]);

    // Update to replace r1 with r2
    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      name: service.name,
      resourceIds: [r2.id],
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.resourceIds).toEqual([r2.id]);
  });

  it("can set policyId on update", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });
    const { policy } = await createPolicy({ ledgerId: ledger.id });

    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      name: "Updated",
      policyId: policy.id,
      resourceIds: [],
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.policyId).toBe(policy.id);
  });

  it("can clear policyId on update", async () => {
    const { ledger } = await createLedger();
    const { policy } = await createPolicy({ ledgerId: ledger.id });
    const { service } = await createService({ ledgerId: ledger.id, policyId: policy.id });

    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      name: "Updated",
      policyId: null,
      resourceIds: [],
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service };
    expect(data.policyId).toBeNull();
  });

  it("returns 404 for non-existent service", async () => {
    const { ledger } = await createLedger();

    const response = await client.put(
      `/v1/ledgers/${ledger.id}/services/svc_00000000000000000000000000`,
      { name: "Test", resourceIds: [] },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for non-existent resourceId", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      name: "Test",
      resourceIds: ["rsc_00000000000000000000000000"],
    });

    expect(response.status).toBe(404);
  });

  it("returns 422 for missing name", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    const response = await client.put(`/v1/ledgers/${ledger.id}/services/${service.id}`, {
      resourceIds: [],
    });

    expect(response.status).toBe(422);
  });
});
