import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService, createPolicy } from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";

describe("PATCH /v1/ledgers/:ledgerId/bookings/:id", () => {
  async function createHoldBooking(ledgerId: string) {
    const { resource } = await createResource({ ledgerId });
    const { policy } = await createPolicy({
      ledgerId,
      config: { schema_version: 1, default_availability: "open", constraints: {} },
    });
    const { service } = await createService({
      ledgerId,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(`/v1/ledgers/${ledgerId}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "hold",
      metadata: { customerName: "Alice" },
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };
    return data;
  }

  it("returns 200 and replaces metadata", async () => {
    const { ledger } = await createLedger();
    const booking = await createHoldBooking(ledger.id);

    const response = await client.patch(`/v1/ledgers/${ledger.id}/bookings/${booking.id}`, {
      metadata: { customerName: "Alice", notes: "Mom is also coming" },
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.id).toBe(booking.id);
    expect(data.metadata).toEqual({ customerName: "Alice", notes: "Mom is also coming" });
  });

  it("works on confirmed bookings", async () => {
    const { ledger } = await createLedger();
    const booking = await createHoldBooking(ledger.id);

    await client.post(`/v1/ledgers/${ledger.id}/bookings/${booking.id}/confirm`);

    const response = await client.patch(`/v1/ledgers/${ledger.id}/bookings/${booking.id}`, {
      metadata: { updated: true },
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.status).toBe("confirmed");
    expect(data.metadata).toEqual({ updated: true });
  });

  it("works on canceled bookings", async () => {
    const { ledger } = await createLedger();
    const booking = await createHoldBooking(ledger.id);

    await client.post(`/v1/ledgers/${ledger.id}/bookings/${booking.id}/cancel`);

    const response = await client.patch(`/v1/ledgers/${ledger.id}/bookings/${booking.id}`, {
      metadata: { cancelReason: "customer request" },
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.status).toBe("canceled");
    expect(data.metadata).toEqual({ cancelReason: "customer request" });
  });

  it("preserves allocations in response", async () => {
    const { ledger } = await createLedger();
    const booking = await createHoldBooking(ledger.id);

    const response = await client.patch(`/v1/ledgers/${ledger.id}/bookings/${booking.id}`, {
      metadata: { foo: "bar" },
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.allocations).toHaveLength(1);
    expect(data.allocations[0]!.active).toBe(true);
  });

  it("returns 404 for non-existent booking", async () => {
    const { ledger } = await createLedger();

    const response = await client.patch(
      `/v1/ledgers/${ledger.id}/bookings/bkg_00000000000000000000000000`,
      { metadata: { foo: "bar" } },
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for missing metadata field", async () => {
    const { ledger } = await createLedger();
    const booking = await createHoldBooking(ledger.id);

    const response = await client.patch(`/v1/ledgers/${ledger.id}/bookings/${booking.id}`, {});

    expect(response.status).toBe(422);
  });
});
