import { db } from "database";
import { createService } from "lib/service";
import { resource } from "@floyd-run/schema/inputs";

export default createService({
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
