import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createService, createBooking } from "../../setup/factories";

describe("DELETE /v1/ledgers/:ledgerId/services/:id", () => {
  it("returns 204 for successful deletion", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/services/${service.id}`);

    expect(response.status).toBe(204);
  });

  it("service is gone after deletion", async () => {
    const { ledger } = await createLedger();
    const { service } = await createService({ ledgerId: ledger.id });

    await client.delete(`/v1/ledgers/${ledger.id}/services/${service.id}`);
    const getResp = await client.get(`/v1/ledgers/${ledger.id}/services/${service.id}`);

    expect(getResp.status).toBe(404);
  });

  it("returns 404 for non-existent service", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(
      `/v1/ledgers/${ledger.id}/services/svc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when service has active hold bookings", async () => {
    const { ledger } = await createLedger();
    const { serviceId } = await createBooking({ ledgerId: ledger.id, status: "hold" });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/services/${serviceId}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("resource.active_bookings");
  });

  it("returns 409 when service has confirmed bookings", async () => {
    const { ledger } = await createLedger();
    const { serviceId } = await createBooking({ ledgerId: ledger.id, status: "confirmed" });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/services/${serviceId}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("resource.active_bookings");
  });

  it("allows deletion when all bookings are canceled", async () => {
    const { ledger } = await createLedger();
    const { serviceId } = await createBooking({ ledgerId: ledger.id, status: "canceled" });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/services/${serviceId}`);

    expect(response.status).toBe(204);
  });

  it("allows deletion when all bookings are expired", async () => {
    const { ledger } = await createLedger();
    const { serviceId } = await createBooking({ ledgerId: ledger.id, status: "expired" });

    const response = await client.delete(`/v1/ledgers/${ledger.id}/services/${serviceId}`);

    expect(response.status).toBe(204);
  });
});
