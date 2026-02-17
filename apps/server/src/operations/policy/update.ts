import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { policyInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";
import { preparePolicyConfig } from "domain/policy";

export default createOperation({
  input: policyInput.update,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Verify policy exists (with row lock)
      const existing = await trx
        .selectFrom("policies")
        .selectAll()
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Policy not found");
      }

      // 2. Normalize, validate, canonicalize, hash
      const { normalized, configHash, warnings } = preparePolicyConfig(
        input.config as unknown as Record<string, unknown>,
      );

      // 3. Insert new version
      const versionId = generateId("pvr");
      const version = await trx
        .insertInto("policyVersions")
        .values({
          id: versionId,
          policyId: input.id,
          config: normalized,
          configSource: input.config as unknown as Record<string, unknown>,
          configHash,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. Update policy metadata + point to new version
      const policy = await trx
        .updateTable("policies")
        .set({
          currentVersionId: versionId,
          name: input.name ?? existing.name,
          description: input.description ?? existing.description,
        })
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return { policy, version, warnings };
    });
  },
});
