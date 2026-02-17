import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policyInput.list,
  execute: async (input) => {
    const policies = await db
      .selectFrom("policies")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    const versionIds = policies.map((p) => p.currentVersionId);

    const versions =
      versionIds.length > 0
        ? await db.selectFrom("policyVersions").selectAll().where("id", "in", versionIds).execute()
        : [];

    const versionMap = new Map(versions.map((v) => [v.id, v]));

    return {
      policies: policies.flatMap((p) => {
        const version = versionMap.get(p.currentVersionId);
        if (!version) return [];
        return [{ policy: p, version }];
      }),
    };
  },
});
