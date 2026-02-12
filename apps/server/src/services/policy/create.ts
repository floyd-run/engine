import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { policy } from "@floyd-run/schema/inputs";
import { normalizePolicyConfig } from "domain/policy/normalize";
import { canonicalizePolicyConfig, hashPolicyConfig } from "domain/policy/canonicalize";
import { validatePolicyConfig } from "domain/policy/validate";

export default createService({
  input: policy.createSchema,
  execute: async (input) => {
    // 1. Normalize authoring format → canonical ms format
    const normalized = normalizePolicyConfig(input.config as unknown as Record<string, unknown>);

    // 2. Validate and generate warnings
    const { warnings } = validatePolicyConfig(normalized);

    // 3. Canonicalize → hash
    const canonicalJson = canonicalizePolicyConfig(normalized);
    const configHash = hashPolicyConfig(canonicalJson);

    // 4. Insert
    const row = await db
      .insertInto("policies")
      .values({
        id: generateId("pol"),
        ledgerId: input.ledgerId,
        config: normalized,
        configHash,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { policy: row, warnings };
  },
});
