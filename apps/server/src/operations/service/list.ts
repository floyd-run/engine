import { db } from "database";
import { createOperation } from "lib/operation";
import { serviceInput } from "@floyd-run/schema/inputs";

export default createOperation({
  input: serviceInput.list,
  execute: async (input) => {
    const services = await db
      .selectFrom("services")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    // Batch load resourceIds for all services
    const resourceIdsByService = new Map<string, string[]>();
    for (const s of services) {
      resourceIdsByService.set(s.id, []);
    }

    if (services.length > 0) {
      const serviceResources = await db
        .selectFrom("serviceResources")
        .selectAll()
        .where(
          "serviceId",
          "in",
          services.map((s) => s.id),
        )
        .execute();

      for (const serviceResource of serviceResources) {
        const list = resourceIdsByService.get(serviceResource.serviceId);
        if (list) {
          list.push(serviceResource.resourceId);
        }
      }
    }

    return {
      services: services.map((s) => ({
        service: s,
        resourceIds: resourceIdsByService.get(s.id) || [],
      })),
    };
  },
});
