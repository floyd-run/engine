import { db } from "database";
import { createOperation } from "lib/operation";
import { service } from "@floyd-run/schema/inputs";

export default createOperation({
  input: service.getSchema,
  execute: async (input) => {
    const svc = await db
      .selectFrom("services")
      .selectAll()
      .where("id", "=", input.id)
      .executeTakeFirst();

    if (!svc) {
      return { service: null, resourceIds: [] };
    }

    const resources = await db
      .selectFrom("serviceResources")
      .select("resourceId")
      .where("serviceId", "=", svc.id)
      .execute();

    return { service: svc, resourceIds: resources.map((r) => r.resourceId) };
  },
});
