import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";
import { ConflictError } from "lib/errors";

export default createOperation({
  input: policyInput.remove,
  execute: async (input) => {
    try {
      return await db.transaction().execute(async (trx) => {
        // Check policy exists
        const policy = await trx
          .selectFrom("policies")
          .select("id")
          .where("id", "=", input.id)
          .where("ledgerId", "=", input.ledgerId)
          .executeTakeFirst();

        if (!policy) return { deleted: false };

        // Clear current_version_id FK before deleting versions
        await trx
          .updateTable("policies")
          .set({ currentVersionId: null })
          .where("id", "=", input.id)
          .execute();

        // Delete associated versions
        await trx.deleteFrom("policyVersions").where("policyId", "=", input.id).execute();

        // Delete the policy
        await trx.deleteFrom("policies").where("id", "=", input.id).execute();

        return { deleted: true };
      });
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && err.code === "23503") {
        throw new ConflictError("policy.in_use", {
          message: "Policy is referenced by one or more services or bookings",
        });
      }
      throw err;
    }
  },
});
