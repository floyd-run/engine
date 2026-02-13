import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createResource, createService } from "../../setup/factories";
import type { Booking } from "@floyd-run/schema/types";

describe("POST /v1/ledgers/:ledgerId/bookings/:id/cancel", () => {
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

  it("returns 200 when canceling a hold booking", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`,
    );

    expect(response.status).toBe(200);
    const { data, meta } = (await response.json()) as {
      data: Booking;
      meta: { serverTime: string };
    };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("canceled");
    expect(data.expiresAt).toBeNull();
    expect(data.allocations).toHaveLength(1);
    expect(data.allocations[0]!.active).toBe(false);
    expect(meta.serverTime).toBeDefined();
  });

  it("returns 200 when canceling a confirmed booking", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    // Confirm first
    const confirmResp = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/confirm`,
    );
    expect(confirmResp.status).toBe(200);

    // Now cancel
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`,
    );

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Booking };
    expect(data.status).toBe("canceled");
    expect(data.allocations[0]!.active).toBe(false);
  });

  it("is idempotent — canceling an already canceled booking returns same data", async () => {
    const { ledger } = await createLedger();
    const holdBooking = await createHoldBooking(ledger.id);

    // Cancel first time
    const resp1 = await client.post(`/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`);
    expect(resp1.status).toBe(200);

    // Cancel second time — idempotent
    const resp2 = await client.post(`/v1/ledgers/${ledger.id}/bookings/${holdBooking.id}/cancel`);
    expect(resp2.status).toBe(200);
    const { data } = (await resp2.json()) as { data: Booking };
    expect(data.id).toBe(holdBooking.id);
    expect(data.status).toBe("canceled");
  });

  it("returns 404 for non-existent booking", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/bookings/bkg_00000000000000000000000000/cancel`,
    );

    expect(response.status).toBe(404);
  });
});
