import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createLedger } from "../../setup/factories";
import type { Allocation } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/allocations/:id", () => {
  it("returns 422 for invalid allocation id", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/allocations/invalid-id`);

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent allocation", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(
      `/v1/ledgers/${ledger.id}/allocations/alc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with allocation data", async () => {
    const { allocation, ledgerId, resourceId } = await createAllocation();
    const response = await client.get(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation };
    expect(data.id).toBe(allocation.id);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.resourceId).toBe(resourceId);
    expect(data.active).toBe(allocation.active);
    expect(data.bookingId).toBe(allocation.bookingId);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
