import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";

const validAuthoringConfig = {
  schema_version: 1,
  default: "closed",
  config: {
    duration: { allowed_minutes: [30, 60] },
    grid: { interval_minutes: 15 },
  },
  rules: [
    {
      match: { type: "weekly", days: ["weekdays"] },
      windows: [{ start: "09:00", end: "17:00" }],
    },
  ],
};

describe("POST /v1/ledgers/:ledgerId/policies", () => {
  it("returns 201 for valid policy with authoring format", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: validAuthoringConfig,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Policy };
    expect(data.id).toMatch(/^pol_/);
    expect(data.ledgerId).toBe(ledger.id);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("normalizes config from authoring format to canonical format", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: validAuthoringConfig,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Policy };
    const config = data.config as Record<string, unknown>;
    const duration = config["config"] as Record<string, Record<string, unknown>>;

    // allowed_minutes: [30, 60] -> allowed_ms: [1800000, 3600000]
    expect(duration["duration"]!["allowed_ms"]).toEqual([1800000, 3600000]);
    expect(duration["duration"]!["allowed_minutes"]).toBeUndefined();

    // interval_minutes: 15 -> interval_ms: 900000
    expect(duration["grid"]!["interval_ms"]).toBe(900000);
    expect(duration["grid"]!["interval_minutes"]).toBeUndefined();

    // weekdays -> expanded day names
    const rules = config["rules"] as Array<{
      match: { days: string[] };
    }>;
    expect(rules[0]!.match.days).toEqual(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  });

  it("returns configHash", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: validAuthoringConfig,
    });

    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: Policy };
    expect(data.configHash).toBeDefined();
    expect(typeof data.configHash).toBe("string");
    expect(data.configHash.length).toBeGreaterThan(0);
  });

  it("returns 422 for invalid schema_version", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: {
        ...validAuthoringConfig,
        schema_version: 2,
      },
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 for missing required fields", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: {
        schema_version: 1,
        // missing default and config
      },
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 for invalid time window where end is before start", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          duration: { allowed_minutes: [30] },
          grid: { interval_minutes: 15 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["monday"] },
            windows: [{ start: "17:00", end: "09:00" }],
          },
        ],
      },
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 for closed rule with windows", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          duration: { allowed_minutes: [30] },
          grid: { interval_minutes: 15 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["monday"] },
            closed: true,
            windows: [{ start: "09:00", end: "17:00" }],
          },
        ],
      },
    });

    expect(response.status).toBe(422);
  });

  it("returns warnings for unreachable rules with duplicate days", async () => {
    const { ledger } = await createLedger();

    const response = await client.post(`/v1/ledgers/${ledger.id}/policies`, {
      config: {
        schema_version: 1,
        default: "closed",
        config: {
          duration: { allowed_minutes: [30] },
          grid: { interval_minutes: 15 },
        },
        rules: [
          {
            match: { type: "weekly", days: ["monday", "tuesday"] },
            windows: [{ start: "09:00", end: "17:00" }],
          },
          {
            match: { type: "weekly", days: ["monday", "wednesday"] },
            windows: [{ start: "10:00", end: "16:00" }],
          },
        ],
      },
    });

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: Policy;
      meta: { warnings: Array<{ code: string; message: string }> };
    };
    expect(body.meta.warnings).toBeDefined();
    expect(body.meta.warnings.length).toBeGreaterThan(0);
    expect(body.meta.warnings[0]!.code).toBe("unreachable_weekly_rule");
  });
});
