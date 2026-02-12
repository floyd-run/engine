import { db } from "database";
import { createService } from "lib/service";
import { policy } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";
import { preparePolicyConfig } from "domain/policy";

export default createService({
  input: policy.updateSchema,
  execute: async (input) => {
    // 1. Verify policy exists
    const existing = await db
      .selectFrom("policies")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError("Policy not found");
    }

    // 2. Normalize, validate, canonicalize, hash
    const { normalized, configHash, warnings } = preparePolicyConfig(
      input.config as unknown as Record<string, unknown>,
    );

    // 3. Update
    const row = await db
      .updateTable("policies")
      .set({
        config: normalized,
        configHash,
      })
      .where("id", "=", input.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { policy: row, warnings };
  },
});
