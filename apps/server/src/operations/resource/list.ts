import { db } from "database";
import { createOperation } from "lib/operation";
import { resourceInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: resourceInput.list,
  execute: async (input) => {
    const resources = await db
      .selectFrom("resources")
      .where("ledgerId", "=", input.ledgerId)
      .selectAll()
      .execute();
    return { resources };
  },
});
