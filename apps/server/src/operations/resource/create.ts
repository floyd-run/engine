import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { resourceInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: resourceInput.create,
  execute: async (input) => {
    const resource = await db
      .insertInto("resources")
      .values({
        id: generateId("rsc"),
        ledgerId: input.ledgerId,
        name: input.name ?? null,
        timezone: input.timezone,
        metadata: input.metadata,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { resource };
  },
});
