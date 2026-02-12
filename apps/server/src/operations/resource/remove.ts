import { resource } from "@floyd-run/schema/inputs";
import { db } from "database";
import { createOperation } from "lib/operation";
import { ConflictError, NotFoundError } from "lib/errors";

export default createOperation({
  input: resource.removeSchema,
  execute: async (input) => {
    try {
      const result = await db
        .deleteFrom("resources")
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        throw new NotFoundError("Resource not found");
      }
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && err.code === "23503") {
        throw new ConflictError("resource_in_use", {
          message: "Resource has active allocations or service associations",
        });
      }
      throw err;
    }
  },
});
