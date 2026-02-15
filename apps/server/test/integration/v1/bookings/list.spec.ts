import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createBooking } from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/bookings", () => {
  it("returns 200 with empty array when no bookings", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/bookings`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking[] };
    expect(data).toEqual([]);
  });

  it("returns bookings for the ledger", async () => {
    const { ledger } = await createLedger();
    await createBooking({ ledgerId: ledger.id });
    await createBooking({ ledgerId: ledger.id });

    const response = await client.get(`/v1/ledgers/${ledger.id}/bookings`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking[] };
    expect(data).toHaveLength(2);
    expect(data[0]!.ledgerId).toBe(ledger.id);
    expect(data[1]!.ledgerId).toBe(ledger.id);
    // Each booking should have allocations
    expect(data[0]!.allocations).toHaveLength(1);
    expect(data[1]!.allocations).toHaveLength(1);
  });

  it("does not return bookings from other ledgers", async () => {
    const { ledger: ledger1 } = await createLedger();
    const { ledger: ledger2 } = await createLedger();

    await createBooking({ ledgerId: ledger1.id });
    await createBooking({ ledgerId: ledger2.id });

    const response = await client.get(`/v1/ledgers/${ledger1.id}/bookings`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking[] };
    expect(data).toHaveLength(1);
    expect(data[0]!.ledgerId).toBe(ledger1.id);
  });
});
