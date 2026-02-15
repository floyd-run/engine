import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createLedger } from "./ledger.factory";
import { preparePolicyConfig } from "domain/policy";

const DEFAULT_CONFIG = {
  schema_version: 1,
  default: "closed",
  config: {
    duration: { allowed_ms: [1800000, 3600000] },
    grid: { interval_ms: 1800000 },
  },
  rules: [
    {
      match: { type: "weekly", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
      windows: [{ start: "09:00", end: "17:00" }],
    },
  ],
};

export async function createPolicy(overrides?: {
  ledgerId?: string;
  config?: Record<string, unknown>;
}) {
  let ledgerId = overrides?.ledgerId;
  if (!ledgerId) {
    const { ledger } = await createLedger();
    ledgerId = ledger.id;
  }

  const rawConfig = overrides?.config ?? DEFAULT_CONFIG;
  const { normalized, configHash } = preparePolicyConfig(rawConfig);

  const policy = await db
    .insertInto("policies")
    .values({
      id: generateId("pol"),
      ledgerId,
      config: normalized,
      configHash,
    })
    .returningAll()
    .executeTakeFirst();

  return { policy: policy!, ledgerId };
}
