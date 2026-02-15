import { describe, expect, it } from "vitest";
import { generateId } from "@floyd-run/utils";
import { client } from "../../setup/client";
import {
  createLedger,
  createResource,
  createPolicy,
  createService,
  createAllocation,
} from "../../setup/factories";

interface SlotsResponse {
  data: {
    resourceId: string;
    timezone: string;
    slots: { startTime: string; endTime: string; status?: "available" | "unavailable" }[];
  }[];
  meta: { serverTime: string };
}

const SALON_POLICY = {
  schema_version: 1,
  default: "closed",
  config: {
    duration: { allowed_minutes: [30, 60, 90] },
    grid: { interval_minutes: 30 },
    buffers: { after_minutes: 10 },
  },
  rules: [
    {
      match: { type: "weekly", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
      windows: [{ start: "09:00", end: "17:00" }],
    },
  ],
};

// Helper: create a standard test setup
async function setupSalon(overrides?: { policyConfig?: Record<string, unknown> }) {
  const { ledger } = await createLedger();
  const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
  const { policy } = await createPolicy({
    ledgerId: ledger.id,
    config: overrides?.policyConfig ?? SALON_POLICY,
  });
  const { service } = await createService({
    ledgerId: ledger.id,
    policyId: policy.id,
    resourceIds: [resource.id],
  });
  return { ledger, resource, policy: policy, service };
}

describe("POST /v1/ledgers/:ledgerId/services/:id/availability/slots", () => {
  it("returns slots for a service with policy", async () => {
    const { ledger, resource, service } = await setupSalon();

    // Monday 2026-03-02
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 3600000, // 60 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.resourceId).toBe(resource.id);
    expect(body.data[0]!.timezone).toBe("UTC");

    // 60min slots with 30min grid on 09:00-17:00 window
    // Slots at 09:00, 09:30, 10:00, ..., 16:00 (last where start + 60min <= 17:00)
    const slots = body.data[0]!.slots;
    expect(slots.length).toBe(15); // 09:00 through 16:00 at 30min intervals
    expect(slots[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(slots[0]!.endTime).toBe("2026-03-02T10:00:00.000Z");
    expect(slots[slots.length - 1]!.startTime).toBe("2026-03-02T16:00:00.000Z");
    expect(slots[slots.length - 1]!.endTime).toBe("2026-03-02T17:00:00.000Z");

    // No status field when includeUnavailable is false
    expect(slots[0]).not.toHaveProperty("status");
  });

  it("grid alignment: overlapping slots with grid < duration", async () => {
    const { ledger, service } = await setupSalon();

    // 90min slots with 30min grid → slots overlap
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 5400000, // 90 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // First slot 09:00-10:30, second 09:30-11:00 — they overlap
    expect(slots[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(slots[0]!.endTime).toBe("2026-03-02T10:30:00.000Z");
    expect(slots[1]!.startTime).toBe("2026-03-02T09:30:00.000Z");
    expect(slots[1]!.endTime).toBe("2026-03-02T11:00:00.000Z");

    // Last slot at 15:30 (15:30 + 90min = 17:00)
    expect(slots[slots.length - 1]!.startTime).toBe("2026-03-02T15:30:00.000Z");
  });

  it("no grid: step defaults to durationMs, non-overlapping", async () => {
    const { ledger, resource } = await createLedger().then(async ({ ledger }) => {
      const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
      return { ledger, resource };
    });

    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          duration: { min_minutes: 60, max_minutes: 120 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["monday"] },
            windows: [{ start: "09:00", end: "13:00" }],
          },
        ],
      },
    });

    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z", // Monday
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 3600000, // 60 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // No grid → step = durationMs = 60min. Slots at 09:00, 10:00, 11:00, 12:00
    expect(slots).toHaveLength(4);
    expect(slots[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(slots[1]!.startTime).toBe("2026-03-02T10:00:00.000Z");
    expect(slots[2]!.startTime).toBe("2026-03-02T11:00:00.000Z");
    expect(slots[3]!.startTime).toBe("2026-03-02T12:00:00.000Z");
  });

  it("skips days where duration is invalid", async () => {
    const { ledger, resource } = await createLedger().then(async ({ ledger }) => {
      const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
      return { ledger, resource };
    });

    // Saturday has restricted durations
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          duration: { allowed_minutes: [30, 60, 90] },
          grid: { interval_minutes: 30 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["weekdays"] },
            windows: [{ start: "09:00", end: "17:00" }],
          },
          {
            match: { type: "weekly", days: ["saturday"] },
            windows: [{ start: "10:00", end: "14:00" }],
            config: {
              duration: { allowed_minutes: [30, 60] },
            },
          },
        ],
      },
    });

    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    // Query Fri 2026-03-06 to Sat 2026-03-07 with 90min duration
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-06T00:00:00Z",
        endTime: "2026-03-08T00:00:00Z",
        durationMs: 5400000, // 90 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // Friday should have slots, Saturday should have none (90min not in [30, 60])
    const fridaySlots = slots.filter((s) => s.startTime.startsWith("2026-03-06"));
    const saturdaySlots = slots.filter((s) => s.startTime.startsWith("2026-03-07"));

    expect(fridaySlots.length).toBeGreaterThan(0);
    expect(saturdaySlots).toHaveLength(0);
  });

  it("filters slots that conflict with allocations", async () => {
    const { ledger, resource, service } = await setupSalon();

    // Create allocation from 10:00-11:00 (with 10min after-buffer → effective 10:00-11:10)
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T11:10:00Z"), // buffer-expanded
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000, // 30 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // Slots whose buffer-expanded times overlap [10:00, 11:10) should be excluded
    // After-buffer is 10min from policy. Before-buffer is 0.
    // So slot at 10:00 → effective [10:00, 10:40) overlaps [10:00, 11:10) → excluded
    // Slot at 10:30 → effective [10:30, 11:10) overlaps → excluded
    // Slot at 11:00 → effective [11:00, 11:40) overlaps (start 11:00 < 11:10) → excluded
    // Slot at 11:30 → effective [11:30, 12:10) does NOT overlap → included
    const slotStarts = slots.map((s) => s.startTime);
    expect(slotStarts).not.toContain("2026-03-02T10:00:00.000Z");
    expect(slotStarts).not.toContain("2026-03-02T10:30:00.000Z");
    expect(slotStarts).not.toContain("2026-03-02T11:00:00.000Z");
    expect(slotStarts).toContain("2026-03-02T11:30:00.000Z");
    expect(slotStarts).toContain("2026-03-02T09:00:00.000Z");
  });

  it("includeUnavailable: returns full grid with status", async () => {
    const { ledger, resource, service } = await setupSalon();

    // Create allocation conflicting with some slots
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T11:10:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
        includeUnavailable: true,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // All slots should have status
    for (const slot of slots) {
      expect(slot.status).toMatch(/^(available|unavailable)$/);
    }

    // Conflicting slots should be unavailable
    const slot1000 = slots.find((s) => s.startTime === "2026-03-02T10:00:00.000Z");
    expect(slot1000).toBeDefined();
    expect(slot1000!.status).toBe("unavailable");

    // Non-conflicting should be available
    const slot0900 = slots.find((s) => s.startTime === "2026-03-02T09:00:00.000Z");
    expect(slot0900).toBeDefined();
    expect(slot0900!.status).toBe("available");
  });

  it("multiple resources: independent slots per resource", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });

    const { policy } = await createPolicy({ ledgerId: ledger.id, config: SALON_POLICY });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [r1.id, r2.id],
    });

    // Allocation only on r1
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: r1.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T11:10:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;

    expect(body.data).toHaveLength(2);
    const r1Data = body.data.find((d) => d.resourceId === r1.id)!;
    const r2Data = body.data.find((d) => d.resourceId === r2.id)!;

    // r2 should have more slots (no conflicts)
    expect(r2Data.slots.length).toBeGreaterThan(r1Data.slots.length);
  });

  it("resourceIds filter: only returns slots for specified resources", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });

    const { policy } = await createPolicy({ ledgerId: ledger.id, config: SALON_POLICY });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [r1.id, r2.id],
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
        resourceIds: [r1.id],
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.resourceId).toBe(r1.id);
  });

  it("rejects resourceIds not in service", async () => {
    const { ledger, service } = await setupSalon();
    const { resource: outsideResource } = await createResource({ ledgerId: ledger.id });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
        resourceIds: [outsideResource.id],
      },
    );

    expect(response.status).toBe(422);
  });

  it("no policy: all times open, grid defaults to durationMs", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: null,
      resourceIds: [resource.id],
    });

    // Query a 2-hour window
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T10:00:00Z",
        endTime: "2026-03-02T12:00:00Z",
        durationMs: 1800000, // 30 min
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    const slots = body.data[0]!.slots;

    // No grid → step = 30min. Window 10:00-12:00 → 4 slots
    expect(slots).toHaveLength(4);
    expect(slots[0]!.startTime).toBe("2026-03-02T10:00:00.000Z");
    expect(slots[3]!.startTime).toBe("2026-03-02T11:30:00.000Z");
  });

  it("rejects query range > 7 days", async () => {
    const { ledger, service } = await setupSalon();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-10T00:00:00Z", // 8 days
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(422);
  });

  it("returns meta.serverTime", async () => {
    const { ledger, service } = await setupSalon();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    expect(body.meta.serverTime).toBeDefined();
    expect(new Date(body.meta.serverTime).getTime()).not.toBeNaN();
  });

  it("returns per-resource timezone", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({
      ledgerId: ledger.id,
      timezone: "America/New_York",
    });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: SALON_POLICY });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    expect(body.data[0]!.timezone).toBe("America/New_York");
  });

  it("closed day (Sunday) produces no slots", async () => {
    const { ledger, service } = await setupSalon();

    // Sunday 2026-03-01
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/slots`,
      {
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-03-01T23:59:59Z",
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as SlotsResponse;
    expect(body.data[0]!.slots).toHaveLength(0);
  });

  it("service not found returns 404", async () => {
    const { ledger } = await createLedger();
    const fakeServiceId = generateId("svc");

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${fakeServiceId}/availability/slots`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        durationMs: 1800000,
      },
    );

    expect(response.status).toBe(404);
  });
});
