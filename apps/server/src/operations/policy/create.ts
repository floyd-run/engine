import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { policyInput } from "@floyd-run/schema/inputs";
import { preparePolicyConfig } from "domain/policy";

export default createOperation({
  input: policyInput.create,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      const { normalized, configHash, warnings } = preparePolicyConfig(
        input.config as unknown as Record<string, unknown>,
      );

      const policyId = generateId("pol");
      const versionId = generateId("pvr");

      // 1. Insert policy (without currentVersionId — circular FK)
      await trx
        .insertInto("policies")
        .values({
          id: policyId,
          ledgerId: input.ledgerId,
          name: input.name ?? null,
          description: input.description ?? null,
        })
        .execute();

      // 2. Insert version
      const version = await trx
        .insertInto("policyVersions")
        .values({
          id: versionId,
          policyId,
          config: normalized,
          configSource: input.config as unknown as Record<string, unknown>,
          configHash,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 3. Set currentVersionId
      const policy = await trx
        .updateTable("policies")
        .set({ currentVersionId: versionId })
        .where("id", "=", policyId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return { policy, version, warnings };
    });
  },
});
