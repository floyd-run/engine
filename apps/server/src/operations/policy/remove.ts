import { db } from "database";
import { createOperation } from "lib/operation";
import { policy } from "@floyd-run/schema/inputs";

export default createOperation({
  input: policy.removeSchema,
  execute: async (input) => {
    const result = await db
      .deleteFrom("policies")
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    return { deleted: result.numDeletedRows > 0n };
  },
});
