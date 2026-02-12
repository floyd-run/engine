import { db } from "database";
import { createOperation } from "lib/operation";
import { service } from "@floyd-run/schema/inputs";

export default createOperation({
  input: service.listSchema,
  execute: async (input) => {
    const services = await db
      .selectFrom("services")
      .selectAll()
      .where("ledgerId", "=", input.ledgerId)
      .execute();

    // Batch load resourceIds for all services
    const resourceIdsByService = new Map<string, string[]>();
    for (const svc of services) {
      resourceIdsByService.set(svc.id, []);
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

      for (const sr of serviceResources) {
        const list = resourceIdsByService.get(sr.serviceId);
        if (list) {
          list.push(sr.resourceId);
        }
      }
    }

    return {
      services: services.map((svc) => ({
        service: svc,
        resourceIds: resourceIdsByService.get(svc.id) || [],
      })),
    };
  },
});
