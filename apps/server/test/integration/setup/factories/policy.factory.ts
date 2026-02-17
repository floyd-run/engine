import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { createLedger } from "./ledger.factory";
import { preparePolicyConfig } from "domain/policy";

const DEFAULT_CONFIG = {
  schema_version: 1,
  default_availability: "closed",
  constraints: {
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
  name?: string | null;
  description?: string | null;
  config?: Record<string, unknown>;
}) {
  let ledgerId = overrides?.ledgerId;
  if (!ledgerId) {
    const { ledger } = await createLedger();
    ledgerId = ledger.id;
  }

  const rawConfig = overrides?.config ?? DEFAULT_CONFIG;
  const { normalized, configHash } = preparePolicyConfig(rawConfig);

  const policyId = generateId("pol");
  const versionId = generateId("pvr");

  // 1. Insert policy (without currentVersionId)
  await db
    .insertInto("policies")
    .values({
      id: policyId,
      ledgerId,
      name: overrides?.name ?? null,
      description: overrides?.description ?? null,
    })
    .execute();

  // 2. Insert version
  const version = await db
    .insertInto("policyVersions")
    .values({
      id: versionId,
      policyId,
      config: normalized,
      configSource: rawConfig,
      configHash,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // 3. Set currentVersionId
  const policy = await db
    .updateTable("policies")
    .set({ currentVersionId: versionId })
    .where("id", "=", policyId)
    .returningAll()
    .executeTakeFirstOrThrow();

  return { policy, version, ledgerId };
}
