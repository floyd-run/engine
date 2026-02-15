import { db } from "database";
import { createOperation } from "lib/operation";
import { policyInput } from "@floyd-run/schema/inputs";
import { ConflictError } from "lib/errors";

export default createOperation({
  input: policyInput.remove,
  execute: async (input) => {
    try {
      const result = await db
        .deleteFrom("policies")
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .executeTakeFirst();

      return { deleted: result.numDeletedRows > 0n };
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && err.code === "23503") {
        throw new ConflictError("policy.in_use", {
          message: "Policy is referenced by one or more services",
        });
      }
      throw err;
    }
  },
});
