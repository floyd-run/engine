import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";
import { preparePolicyConfig } from "domain/policy";

export default createOperation({
  input: policyInput.update,
  execute: async (input) => {
    // 1. Verify policy exists
    const existing = await db
      .selectFrom("policies")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
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
      .where("ledgerId", "=", input.ledgerId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { policy: row, warnings };
  },
});
