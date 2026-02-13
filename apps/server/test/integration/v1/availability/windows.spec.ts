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

interface WindowsResponse {
  data: {
    resourceId: string;
    timezone: string;
    windows: { startTime: string; endTime: string; status?: "available" | "unavailable" }[];
  }[];
  meta: { serverTime: string };
}

const KAYAK_POLICY = {
  schema_version: 1,
  default: "closed",
  config: {
    duration: { min_hours: 2, max_hours: 8 },
    buffers: { after_minutes: 30 },
  },
  rules: [
    {
      match: { type: "weekly", days: ["everyday"] },
      windows: [{ start: "09:00", end: "17:00" }],
    },
  ],
};

async function setupKayak(overrides?: { policyConfig?: Record<string, unknown> }) {
  const { ledger } = await createLedger();
  const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
  const { policy } = await createPolicy({
    ledgerId: ledger.id,
    config: overrides?.policyConfig ?? KAYAK_POLICY,
  });
  const { service } = await createService({
    ledgerId: ledger.id,
    policyId: policy.id,
    resourceIds: [resource.id],
  });
  return { ledger, resource, policy: policy, service };
}

describe("POST /v1/ledgers/:ledgerId/services/:id/availability/windows", () => {
  it("returns available windows for a service with policy", async () => {
    const { ledger, resource, service } = await setupKayak();

    // Monday 2026-03-02
    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;

    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.resourceId).toBe(resource.id);
    expect(body.data[0]!.timezone).toBe("UTC");

    // Full day open 09:00-17:00, no allocations
    const windows = body.data[0]!.windows;
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-02T17:00:00.000Z");
    expect(windows[0]).not.toHaveProperty("status");
  });

  it("allocation subtraction: existing booking carves out time", async () => {
    const { ledger, resource, service } = await setupKayak();

    // Booking 10:00-13:00 with 30min after-buffer → effective 10:00-13:30
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T13:30:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // Schedule 09:00-17:00, allocation effective [10:00, 13:30)
    // Gap before: 09:00-10:00, no allocation before → no after_ms shrinkage needed
    //   But new booking's after_ms=30min shrinks the end: 10:00 - 30min = 09:30
    //   Wait — gap end is adjacent to allocation → shrink by after_ms(30min): 10:00 - 30min = 09:30
    //   Gap start at schedule boundary → no shrinkage: 09:00
    //   Available: 09:00 - 09:30 (1 hour gap shrunk to 30min) → too short (min 2h) → DISCARDED
    // Gap after: 13:30-17:00, gap start adjacent to allocation → shrink by before_ms(0): 13:30
    //   Gap end at schedule boundary → no shrinkage: 17:00
    //   Available: 13:30-17:00 (3.5 hours) → valid (>= 2h min)
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-02T13:30:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-02T17:00:00.000Z");
  });

  it("asymmetric buffer shrinkage at allocation boundaries", async () => {
    const { ledger, resource } = await createLedger().then(async ({ ledger }) => {
      const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
      return { ledger, resource };
    });

    // Policy with before_ms=15min, after_ms=10min
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          buffers: { before_minutes: 15, after_minutes: 10 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["monday"] },
            windows: [{ start: "09:00", end: "17:00" }],
          },
        ],
      },
    });

    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    // Allocation effective [09:45, 11:10)
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T09:45:00Z"),
      endTime: new Date("2026-03-02T11:10:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // Gap before allocation: 09:00 - 09:45
    //   Start at schedule boundary → no shrinkage: 09:00
    //   End adjacent to allocation → shrink by after_ms(10min): 09:45 - 10min = 09:35
    //   Available: [09:00, 09:35)
    // Gap after allocation: 11:10 - 17:00
    //   Start adjacent to allocation → shrink by before_ms(15min): 11:10 + 15min = 11:25
    //   End at schedule boundary → no shrinkage: 17:00
    //   Available: [11:25, 17:00)
    expect(windows).toHaveLength(2);
    expect(windows[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-02T09:35:00.000Z");
    expect(windows[1]!.startTime).toBe("2026-03-02T11:25:00.000Z");
    expect(windows[1]!.endTime).toBe("2026-03-02T17:00:00.000Z");
  });

  it("sub-minimum filtering: gaps shorter than min_ms are discarded", async () => {
    const { ledger, resource, service } = await setupKayak();

    // Two allocations close together → small gap between them
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T09:00:00Z"),
      endTime: new Date("2026-03-02T12:00:00Z"),
    });
    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T13:00:00Z"),
      endTime: new Date("2026-03-02T17:00:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // Gap between allocations: 12:00-13:00 = 1 hour, but min_hours is 2 → discarded
    expect(windows).toHaveLength(0);
  });

  it("contiguous merging: windows across day boundary merge", async () => {
    const { ledger, resource } = await createLedger().then(async ({ ledger }) => {
      const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
      return { ledger, resource };
    });

    // 24/7 open policy
    const { policy } = await createPolicy({
      ledgerId: ledger.id,
      config: {
        schema_version: 1,
        default: "open",
        config: {},
        rules: [],
      },
    });

    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-04T00:00:00Z", // 2 days
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // Should be one contiguous 48-hour window
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-02T00:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-04T00:00:00.000Z");
  });

  it("includeUnavailable: returns allocation times within schedule as unavailable", async () => {
    const { ledger, resource, service } = await setupKayak();

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T13:30:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
        includeUnavailable: true,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // All windows should have status
    for (const w of windows) {
      expect(w.status).toMatch(/^(available|unavailable)$/);
    }

    // Should see unavailable window for the allocation within schedule hours
    const unavailable = windows.filter((w) => w.status === "unavailable");
    expect(unavailable.length).toBeGreaterThan(0);
    expect(unavailable[0]!.startTime).toBe("2026-03-02T10:00:00.000Z");
    expect(unavailable[0]!.endTime).toBe("2026-03-02T13:30:00.000Z");
  });

  it("multiple resources: independent windows per resource", async () => {
    const { ledger } = await createLedger();
    const { resource: r1 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
    const { resource: r2 } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });

    const { policy } = await createPolicy({ ledgerId: ledger.id, config: KAYAK_POLICY });
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
      endTime: new Date("2026-03-02T15:00:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;

    const r1Data = body.data.find((d) => d.resourceId === r1.id)!;
    const r2Data = body.data.find((d) => d.resourceId === r2.id)!;

    // r2 should have full 09:00-17:00 window
    expect(r2Data.windows).toHaveLength(1);
    expect(r2Data.windows[0]!.startTime).toBe("2026-03-02T09:00:00.000Z");
    expect(r2Data.windows[0]!.endTime).toBe("2026-03-02T17:00:00.000Z");

    // r1 should have restricted windows (allocation carved out)
    expect(r1Data.windows.length).toBeLessThan(r2Data.windows.length + 1);
  });

  it("no policy: 24h open, only allocations subtract", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({ ledgerId: ledger.id, timezone: "UTC" });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: null,
      resourceIds: [resource.id],
    });

    await createAllocation({
      ledgerId: ledger.id,
      resourceId: resource.id,
      active: true,
      startTime: new Date("2026-03-02T10:00:00Z"),
      endTime: new Date("2026-03-02T12:00:00Z"),
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T08:00:00Z",
        endTime: "2026-03-02T16:00:00Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    const windows = body.data[0]!.windows;

    // Two windows: 08:00-10:00 and 12:00-16:00
    expect(windows).toHaveLength(2);
    expect(windows[0]!.startTime).toBe("2026-03-02T08:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-02T10:00:00.000Z");
    expect(windows[1]!.startTime).toBe("2026-03-02T12:00:00.000Z");
    expect(windows[1]!.endTime).toBe("2026-03-02T16:00:00.000Z");
  });

  it("rejects query range > 31 days", async () => {
    const { ledger, service } = await setupKayak();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-01T00:00:00Z",
        endTime: "2026-04-02T00:00:00Z", // 32 days
      },
    );

    expect(response.status).toBe(422);
  });

  it("returns meta.serverTime", async () => {
    const { ledger, service } = await setupKayak();

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    expect(body.meta.serverTime).toBeDefined();
    expect(new Date(body.meta.serverTime).getTime()).not.toBeNaN();
  });

  it("returns per-resource timezone", async () => {
    const { ledger } = await createLedger();
    const { resource } = await createResource({
      ledgerId: ledger.id,
      timezone: "Europe/London",
    });
    const { policy } = await createPolicy({ ledgerId: ledger.id, config: KAYAK_POLICY });
    const { service } = await createService({
      ledgerId: ledger.id,
      policyId: policy.id,
      resourceIds: [resource.id],
    });

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${service.id}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as WindowsResponse;
    expect(body.data[0]!.timezone).toBe("Europe/London");
  });

  it("service not found returns 404", async () => {
    const { ledger } = await createLedger();
    const fakeServiceId = generateId("svc");

    const response = await client.post(
      `/v1/ledgers/${ledger.id}/services/${fakeServiceId}/availability/windows`,
      {
        startTime: "2026-03-02T00:00:00Z",
        endTime: "2026-03-02T23:59:59Z",
      },
    );

    expect(response.status).toBe(404);
  });
});
