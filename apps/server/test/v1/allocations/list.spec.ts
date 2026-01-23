import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createLedger } from "../../setup/factories";
import { Allocation } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/allocations", () => {
  it("returns 200 with empty array when no allocations", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data).toEqual([]);
  });

  it("returns allocations for the ledger", async () => {
    const { ledger } = await createLedger();

    // Create two allocations for this ledger
    await createAllocation({ ledgerId: ledger.id });
    await createAllocation({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data.length).toBe(2);
    expect(data[0]?.ledgerId).toBe(ledger.id);
    expect(data[1]?.ledgerId).toBe(ledger.id);
  });

  it("does not return allocations from other ledgers", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();

    // Create allocation for ledger1
    await createAllocation({ ledgerId: ledger1.id });
    // Create allocation for ledger2
    await createAllocation({ ledgerId: ledger2.id });

    const response = await client.get(`/v1/ledgers/${ledger1.id}/allocations`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Allocation[] };
    expect(data.length).toBe(1);
    expect(data[0]!.ledgerId).toBe(ledger1.id);
  });
});
