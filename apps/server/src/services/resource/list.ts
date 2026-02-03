import { db } from "database";
import { createService } from "lib/service";
import { resource } from "@floyd-run/schema/inputs";

export default createService({
  input: resource.listSchema,
  execute: async (input) => {
    const resources = await db
      .selectFrom("resources")
      .where("ledgerId", "=", input.ledgerId)
      .selectAll()
      .execute();
    return { resources };
  },
});
