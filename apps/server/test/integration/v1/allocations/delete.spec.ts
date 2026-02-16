import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createBooking, createLedger } from "../../setup/factories";
import { db } from "database";
import type { Allocation } from "@floyd-run/schema/types";

describe("DELETE /v1/ledgers/:ledgerId/allocations/:id", () => {
  it("returns 204 for successful deletion of raw allocation", async () => {
    const { allocation, ledgerId } = await createAllocation();

    const response = await client.delete(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);

    expect(response.status).toBe(204);
  });

  it("creates allocation.deleted event in outbox", async () => {
    const { allocation, ledgerId } = await createAllocation();

    const response = await client.delete(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);

    expect(response.status).toBe(204);

    // Verify event was created in outbox
    const event = await db
      .selectFrom("outboxEvents")
      .selectAll()
      .where("ledgerId", "=", ledgerId)
      .where("eventType", "=", "allocation.deleted")
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    expect(event).toBeDefined();
    expect(event?.eventType).toBe("allocation.deleted");
    expect(event?.ledgerId).toBe(ledgerId);
    expect(event?.publishedAt).toBeNull();
    expect(event?.publishAttempts).toBe(0);

    // Verify payload contains deleted allocation data
    const payload = event?.payload as {
      id: string;
      type: string;
      data: { allocation: Allocation };
    };
    expect(payload.type).toBe("allocation.deleted");
    expect(payload.data.allocation.id).toBe(allocation.id);
  });

  it("allocation is gone after deletion", async () => {
    const { allocation, ledgerId } = await createAllocation();

    await client.delete(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);
    const getResp = await client.get(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);

    expect(getResp.status).toBe(404);
  });

  it("returns 404 for non-existent allocation", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(
      `/v1/ledgers/${ledger.id}/allocations/alc_00000000000000000000000000`,
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for invalid allocation id", async () => {
    const { ledger } = await createLedger();

    const response = await client.delete(`/v1/ledgers/${ledger.id}/allocations/invalid-id`);

    expect(response.status).toBe(422);
  });

  it("returns 409 for booking-owned allocation", async () => {
    const { allocation, ledgerId } = await createBooking();

    const response = await client.delete(`/v1/ledgers/${ledgerId}/allocations/${allocation.id}`);

    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("allocation.managed_by_booking");
  });
});
