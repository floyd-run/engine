import { resource } from "@floyd-run/schema/inputs";
import { db } from "database";
import { createService } from "lib/service";

export default createService({
  input: resource.removeSchema,
  execute: async (input) => {
    await db.deleteFrom("resources").where("id", "=", input.id).executeTakeFirstOrThrow();
  },
});
