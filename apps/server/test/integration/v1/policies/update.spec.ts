import { describe, expect, it } from "vitest";
import { client } from "../../setup/client";
import { createLedger, createPolicy } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";

const validConfig = {
  schema_version: 1,
  default_availability: "closed",
  constraints: {
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

const updatedConfig = {
  schema_version: 1,
  default_availability: "open",
  constraints: {
    duration: { allowed_minutes: [45, 90] },
    grid: { interval_minutes: 30 },
  },
  rules: [
    {
      match: { type: "weekly", days: ["weekends"] },
      windows: [{ start: "10:00", end: "16:00" }],
    },
  ],
};

describe("PUT /v1/ledgers/:ledgerId/policies/:id", () => {
  it("returns 200 for valid update", async () => {
    const { policy, ledgerId } = await createPolicy();

    const response = await client.put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
      config: updatedConfig,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy };
    expect(data.id).toBe(policy.id);
    expect(data.ledgerId).toBe(ledgerId);
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
  });

  it("updates config and recalculates hash", async () => {
    const { version, ledgerId, policy } = await createPolicy();
    const originalHash = version.configHash;

    const response = await client.put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
      config: updatedConfig,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy };

    // Config should reflect the updated values (normalized)
    const config = data.config;
    expect(config["default_availability"] as string).toBe("open");

    // Hash should be recalculated and differ from original
    expect(data.configHash).toBeDefined();
    expect(data.configHash).not.toBe(originalHash);
  });

  it("returns 404 for non-existent policy", async () => {
    const { ledger } = await createLedger();

    const response = await client.put(
      `/v1/ledgers/${ledger.id}/policies/pol_00000000000000000000000000`,
      { config: validConfig },
    );

    expect(response.status).toBe(404);
  });

  it("returns 422 for invalid config", async () => {
    const { policy, ledgerId } = await createPolicy();

    const response = await client.put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
      config: {
        schema_version: 2,
        default_availability: "closed",
        constraints: {},
      },
    });

    expect(response.status).toBe(422);
  });
});
