import { describe, expect, it } from "vitest";
import { createLedger, createPolicy } from "../../setup/factories";
import type { Policy } from "@floyd-run/schema/types";
import type { Hono } from "hono";

// The shared client does not expose a PUT method, so we construct requests directly.
const { default: app } = await import("../../../src/app");

async function put(path: string, body: unknown): Promise<Response> {
  const request = new Request(`http://localhost${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (app as Hono).request(request as Request);
}

const validConfig = {
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

const updatedConfig = {
  schema_version: 1,
  default: "open",
  config: {
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

    const response = await put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
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
    const { policy, ledgerId } = await createPolicy();
    const originalHash = policy.configHash;

    const response = await put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
      config: updatedConfig,
    });

    expect(response.status).toBe(200);
    const { data } = (await response.json()) as { data: Policy };

    // Config should reflect the updated values (normalized)
    const config = data.config as Record<string, unknown>;
    expect(config["default"] as string).toBe("open");

    // Hash should be recalculated and differ from original
    expect(data.configHash).toBeDefined();
    expect(data.configHash).not.toBe(originalHash);
  });

  it("returns 404 for non-existent policy", async () => {
    const { ledger } = await createLedger();

    const response = await put(`/v1/ledgers/${ledger.id}/policies/pol_00000000000000000000000000`, {
      config: validConfig,
    });

    expect(response.status).toBe(404);
  });

  it("returns 422 for invalid config", async () => {
    const { policy, ledgerId } = await createPolicy();

    const response = await put(`/v1/ledgers/${ledgerId}/policies/${policy.id}`, {
      config: {
        schema_version: 2,
        default: "closed",
        config: {},
      },
    });

    expect(response.status).toBe(422);
  });
});
