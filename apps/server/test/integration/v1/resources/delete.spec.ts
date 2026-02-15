import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import {
  createLedger,
  createResource,
  createAllocation,
  createService,
} from "../../setup/factories";

describe("DELETE /v1/ledgers/:ledgerId/resources/:id", () => {
  it("returns 204 for successful deletion", async () => {
    const { resource, ledgerId } = await createResource();

    const response = await client.delete(`/v1/ledgers/${ledgerId}/resources/${resource.id}`);

    expect(response.status).toBe(204);
  });

  it("returns 404 for non-existent resource", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(
      `/v1/ledgers/${ledger.id}/resources/rsc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when resource has active allocations", async () => {
    const { resource, ledgerId } = await createResource();
    await createAllocation({
      ledgerId,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-06-01T10:00:00Z"),
      endTime: new Date("2026-06-01T11:00:00Z"),
    });

    const response = await client.delete(`/v1/ledgers/${ledgerId}/resources/${resource.id}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("resource.in_use");
  });

  it("returns 409 when resource belongs to a service", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });
    await createService({
      ledgerId: ledger.id,
      resourceIds: [resource.id],
    });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/resources/${resource.id}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("resource.in_use");
  });
});
