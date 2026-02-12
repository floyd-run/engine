import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createService } from "../../setup/factories";
import type { Service } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/services", () => {
  it("returns 200 with empty array when no services", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/services`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service[] };
    expect(data).toEqual([]);
  });

  it("returns services for the ledger", async () => {
    const { ledger } = await createLedger();
    await createService({ ledgerId: ledger.id, name: "Service A" });
    await createService({ ledgerId: ledger.id, name: "Service B" });

    const response = await client.get(`/v1/ledgers/${ledger.id}/services`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service[] };
    expect(data).toHaveLength(2);
    expect(data[0]!.ledgerId).toBe(ledger.id);
    expect(data[1]!.ledgerId).toBe(ledger.id);
  });

  it("does not return services from other ledgers", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();

    await createService({ ledgerId: ledger1.id, name: "Ledger 1 Service" });
    await createService({ ledgerId: ledger2.id, name: "Ledger 2 Service" });

    const response = await client.get(`/v1/ledgers/${ledger1.id}/services`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Service[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.ledgerId).toBe(ledger1.id);
  });
});
