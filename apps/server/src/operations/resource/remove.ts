import { resource } from "@floyd-run/schema/inputs";
import { db } from "database";
import { createOperation } from "lib/operation";

export default createOperation({
  input: resource.removeSchema,
  execute: async (input) => {
    await db.deleteFrom("resources").where("id", "=", input.id).executeTakeFirstOrThrow();
  },
});
