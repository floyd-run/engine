import { resource } from "@floyd-run/schema/inputs";
import { db } from "database";
import { createOperation } from "lib/operation";
import { NotFoundError } from "lib/errors";

export default createOperation({
  input: resource.removeSchema,
  execute: async (input) => {
    const result = await db
      .deleteFrom("resources")
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundError("Resource not found");
    }
  },
});
