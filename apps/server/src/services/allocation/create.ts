import { db } from "database";
import { createService } from "lib/service";
import { generateId } from "@floyd-run/utils";
import { allocation } from "@floyd-run/schema/inputs";

export default createService({
  input: allocation.createSchema,
  execute: async (input) => {
    const allocation = await db
      .insertInto("allocations")
      .values({
        id: generateId("alloc"),
        workspaceId: input.workspaceId,
        resourceId: input.resourceId,
        status: input.status,
        startAt: input.startAt,
        endAt: input.endAt,
        expiresAt: input.expiresAt ?? null,
        version: input.version,
        metadata: input.metadata ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { allocation };
  },
});
