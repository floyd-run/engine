import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { resource } from "@floyd-run/schema/inputs";

export default createService({
  input: resource.createSchema,
  execute: async (input) => {
    const resource = await db
      .insertInto("resources")
      .values({
        id: generateId("rsc"),
        ledgerId: input.ledgerId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { resource };
  },
});
