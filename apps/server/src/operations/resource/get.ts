import { db } from "database";
import { createOperation } from "lib/operation";
import { resource } from "@floyd-run/schema/inputs";

export default createOperation({
  input: resource.getSchema,
  execute: async (input) => {
    const resource = await db
      .selectFrom("resources")
      .where("id", "=", input.id)
      .selectAll()
      .executeTakeFirst();

    return { resource };
  },
});
