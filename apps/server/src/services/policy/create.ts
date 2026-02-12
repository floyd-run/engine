import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { policy } from "@floyd-run/schema/inputs";
import { preparePolicyConfig } from "domain/policy";

export default createService({
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
