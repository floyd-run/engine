import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policyInput.get,
  execute: async (input) => {
    const policy = await db
      .selectFrom("policies")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    if (!policy) {
      return { policy: null, version: null };
    }

    const version = await db
      .selectFrom("policyVersions")
      .selectAll()
      .where("id", "=", policy.currentVersionId)
      .executeTakeFirstOrThrow();

    return { policy, version };
  },
});
