import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { policy } from "@floyd-run/schema/inputs";
import { preparePolicyConfig } from "domain/policy";

export default createOperation({
  input: policy.createSchema,
  execute: async (input) => {
    const { normalized, configHash, warnings } = preparePolicyConfig(
      input.config as unknown as Record<string, unknown>,
    );

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
