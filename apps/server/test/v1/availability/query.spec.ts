import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createAllocation, createLedger, createResource } from "../../setup/factories";
import type { AvailabilityResponse } from "../../setup/types";

describe("POST /v1/ledgers/:ledgerId/availability", () => {
  it("returns full window as free when no allocations", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data).toHaveLength(1);
    expect(data[0]!.resourceId).toBe(resource.id);
    expect(data[0]!.timeline).toEqual([{ startAt, endAt, status: "free" }]);
  });

  it("returns busy block for confirmed allocation", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const allocStart = new Date("2026-01-01T10:30:00.000Z");
    const allocEnd = new Date("2026-01-01T11:00:00.000Z");

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: allocStart,
      endAt: allocEnd,
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data[0]!.timeline).toEqual([
      { startAt: "2026-01-01T10:00:00.000Z", endAt: "2026-01-01T10:30:00.000Z", status: "free" },
      { startAt: "2026-01-01T10:30:00.000Z", endAt: "2026-01-01T11:00:00.000Z", status: "busy" },
      { startAt: "2026-01-01T11:00:00.000Z", endAt: "2026-01-01T12:00:00.000Z", status: "free" },
    ]);
  });

  it("returns busy block for unexpired hold", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const allocStart = new Date("2026-01-01T10:30:00.000Z");
    const allocEnd = new Date("2026-01-01T11:00:00.000Z");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "hold",
      startAt: allocStart,
      endAt: allocEnd,
      expiresAt,
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data[0]!.timeline).toHaveLength(3);
    expect(data[0]!.timeline[1]!.status).toBe("busy");
  });

  it("ignores expired holds", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    const allocStart = new Date("2026-01-01T10:30:00.000Z");
    const allocEnd = new Date("2026-01-01T11:00:00.000Z");
    const expiresAt = new Date(Date.now() - 60 * 1000); // expired 1 minute ago

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "hold",
      startAt: allocStart,
      endAt: allocEnd,
      expiresAt,
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    // Expired hold should not block - entire window is free
    expect(data[0]!.timeline).toEqual([{ startAt, endAt, status: "free" }]);
  });

  it("ignores cancelled allocations", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "cancelled",
      startAt: new Date("2026-01-01T10:30:00.000Z"),
      endAt: new Date("2026-01-01T11:00:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data[0]!.timeline).toEqual([{ startAt, endAt, status: "free" }]);
  });

  it("merges overlapping allocations", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    // Two overlapping allocations: 10:30-11:00 and 10:45-11:15
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T10:30:00.000Z"),
      endAt: new Date("2026-01-01T11:00:00.000Z"),
    });
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T10:45:00.000Z"),
      endAt: new Date("2026-01-01T11:15:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    // Should be merged into single busy block 10:30-11:15
    expect(data[0]!.timeline).toEqual([
      { startAt: "2026-01-01T10:00:00.000Z", endAt: "2026-01-01T10:30:00.000Z", status: "free" },
      { startAt: "2026-01-01T10:30:00.000Z", endAt: "2026-01-01T11:15:00.000Z", status: "busy" },
      { startAt: "2026-01-01T11:15:00.000Z", endAt: "2026-01-01T12:00:00.000Z", status: "free" },
    ]);
  });

  it("merges adjacent allocations", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    // Two adjacent allocations: 10:30-11:00 and 11:00-11:30
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T10:30:00.000Z"),
      endAt: new Date("2026-01-01T11:00:00.000Z"),
    });
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T11:00:00.000Z"),
      endAt: new Date("2026-01-01T11:30:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    // Should be merged into single busy block 10:30-11:30
    expect(data[0]!.timeline).toEqual([
      { startAt: "2026-01-01T10:00:00.000Z", endAt: "2026-01-01T10:30:00.000Z", status: "free" },
      { startAt: "2026-01-01T10:30:00.000Z", endAt: "2026-01-01T11:30:00.000Z", status: "busy" },
      { startAt: "2026-01-01T11:30:00.000Z", endAt: "2026-01-01T12:00:00.000Z", status: "free" },
    ]);
  });

  it("clamps allocations to query window", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    // Allocation extends before and after the query window
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T09:00:00.000Z"),
      endAt: new Date("2026-01-01T13:00:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    // Should be clamped to query window
    expect(data[0]!.timeline).toEqual([{ startAt, endAt, status: "busy" }]);
  });

  it("handles multiple resources", async () => {
    const { ledger } = await createLedger();
    const { resource: resource1 } = await createResource({ ledgerId: ledger.id });
    const { resource: resource2 } = await createResource({ ledgerId: ledger.id });

    // Allocation on resource1 only
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource1.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T10:30:00.000Z"),
      endAt: new Date("2026-01-01T11:00:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource1.id, resource2.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data).toHaveLength(2);

    const item1 = data.find((d) => d.resourceId === resource1.id)!;
    const item2 = data.find((d) => d.resourceId === resource2.id)!;

    expect(item1.timeline).toHaveLength(3);
    expect(item1.timeline[1]!.status).toBe("busy");

    expect(item2.timeline).toEqual([{ startAt, endAt, status: "free" }]);
  });

  it("excludes allocations outside query window", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id });

    // Allocation completely outside the query window
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      status: "confirmed",
      startAt: new Date("2026-01-01T08:00:00.000Z"),
      endAt: new Date("2026-01-01T09:00:00.000Z"),
    });

    const startAt = "2026-01-01T10:00:00.000Z";
    const endAt = "2026-01-01T12:00:00.000Z";

    const response = await client.post(`/v1/ledgers/${ledger.id}/availability`, {
      resourceIds: [resource.id],
      startAt,
      endAt,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as AvailabilityResponse;

    expect(data[0]!.timeline).toEqual([{ startAt, endAt, status: "free" }]);
  });
});
