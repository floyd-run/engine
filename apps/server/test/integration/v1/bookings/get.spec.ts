import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createBooking } from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";

describe("GET /v1/ledgers/:ledgerId/bookings/:id", () => {
  it("returns 422 for invalid booking id", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(`/v1/ledgers/${ledger.id}/bookings/invalid-id`);

    expect(response.status).toBe(422);
  });

  it("returns 404 for non-existent booking", async () => {
    const { ledger } = await createLedger();
    const response = await client.get(
      `/v1/ledgers/${ledger.id}/bookings/bkg_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with booking data and nested allocations", async () => {
    const { booking, ledgerId, serviceId, resourceId } = await createBooking();

    const response = await client.get(`/v1/ledgers/${ledgerId}/bookings/${booking.id}`);

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.id).toBe(booking.id);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.serviceId).toBe(serviceId);
    expect(data.status).toBe("hold");
    expect(data.allocations).toHaveLength(1);
    expect(data.allocations[0]!.resourceId).toBe(resourceId);
    expect(data.allocations[0]!.active).toBe(true);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });
});
