import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService } from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";

describe("POST /v1/ledgers/:ledgerId/bookings/:id/confirm", () => {
  async function createHoldBooking(ledgerId: string) {
    const { resource } = await createResource({ ledgerId });
    const { service } = await createService({ ledgerId, resourceIds: [resource.id] });

    const response = await client.post(`/v1/ledgers/${ledgerId}/bookings`, {
      serviceId: service.id,
      resourceId: resource.id,
      startTime: "2026-06-01T10:00:00.000Z",
      endTime: "2026-06-01T11:00:00.000Z",
      status: "hold",
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Booking };
    return data;
  }

  it("returns 200 when confirming a hold booking", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
    );

    expect(response.status).toBe(200);
    const { data, meta } = (await response.json()) as {
      data: Booking;
      meta: { serverTime: string };
    };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("confirmed");
    expect(data.expiresAt).toBeNull();
    expect(data.allocations).toHaveLength(1);
    expect(meta.serverTime).toBeDefined();
  });

  it("is idempotent — confirming an already confirmed booking returns same data", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    // Confirm first time
    const resp1 = await client.post(`/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`);
    expect(resp1.status).toBe(200);

    // Confirm second time — idempotent
    const resp2 = await client.post(`/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`);
    expect(resp2.status).toBe(200);
    const { data } = (await resp2.json()) as { data: Booking };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("confirmed");
  });

  it("handles Idempotency-Key header with empty body", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    // Confirm with idempotency key but no body
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
      undefined,
      {
        headers: {
          "Idempotency-Key": "test-confirm-empty-body-123",
        },
      },
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.status).toBe("confirmed");

    // Second request with same key returns cached response
    const response2 = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
      undefined,
      {
        headers: {
          "Idempotency-Key": "test-confirm-empty-body-123",
        },
      },
    );

    expect(response2.status).toBe(200);
  });

  it("returns 404 for non-existent booking", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/bkg_00000000000000000000000000/confirm`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when confirming a canceled booking", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    // Cancel first
    const cancelResp = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`,
    );
    expect(cancelResp.status).toBe(200);

    // Try to confirm
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("booking.invalid_transition");
  });
});
