import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { ResourceResponse } from "../../setup/types";

describe("POST /v1/ledgers/:ledgerId/resources", () => {
  it("returns 201 with created resource", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      name: "Room A",
      timezone: "UTC",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.id).toMatch(/^rsc_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.name).toBe("Room A");
    expect(data.metadata).toEqual({});
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("returns 201 with valid IANA timezone", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      name: "Room B",
      timezone: "America/New_York",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.timezone).toBe("America/New_York");
  });

  it("returns 201 with custom metadata", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      name: "Room C",
      timezone: "UTC",
      metadata: { floor: 3, building: "HQ" },
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.metadata).toEqual({ floor: 3, building: "HQ" });
  });

  it("returns 422 for invalid timezone", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      name: "Room D",
      timezone: "Not/A_Timezone",
    });

    expect(response.status).toBe(422);
  });

  it("returns 201 with null name when not provided", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      timezone: "UTC",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as ResourceResponse;
    expect(data.name).toBeNull();
  });

  it("returns 422 when name exceeds 255 characters", async () => {
    const { ledger } = await createLedger();
    const response = await client.post(`/v1/ledgers/${ledger.id}/resources`, {
      name: "x".repeat(256),
      timezone: "UTC",
    });

    expect(response.status).toBe(422);
  });
});
