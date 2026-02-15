import { db } from "database";
import { createOperation } from "lib/operation";
import { serviceInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: serviceInput.get,
  execute: async (input) => {
    const service = await db
      .selectFrom("services")
      .selectAll()
      .where("id", "=", input.id)
      .where("ledgerId", "=", input.ledgerId)
      .executeTakeFirst();

    if (!service) {
      return { service: null, resourceIds: [] };
    }

    const resources = await db
      .selectFrom("serviceResources")
      .select("resourceId")
      .where("serviceId", "=", service.id)
      .execute();

    return { service, resourceIds: resources.map((r) => r.resourceId) };
  },
});
