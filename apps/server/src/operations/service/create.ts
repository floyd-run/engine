import { db } from "database";
import { createOperation } from "lib/operation";
import { generateId } from "@floyd-run/utils";
import { serviceInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";

export default createOperation({
  input: serviceInput.create,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Validate policyId exists and belongs to ledger (if provided)
      if (input.policyId) {
        const policy = await trx
          .selectFrom("policies")
          .select("id")
          .where("id", "=", input.policyId)
          .where("ledgerId", "=", input.ledgerId)
          .executeTakeFirst();

        if (!policy) {
          throw new NotFoundError("Policy not found");
        }
      }

      // 2. Validate all resourceIds exist and belong to same ledger
      if (input.resourceIds.length > 0) {
        const resources = await trx
          .selectFrom("resources")
          .select("id")
          .where("id", "in", input.resourceIds)
          .where("ledgerId", "=", input.ledgerId)
          .execute();

        if (resources.length !== input.resourceIds.length) {
          const found = new Set(resources.map((r) => r.id));
          const missing = input.resourceIds.filter((id) => !found.has(id));
          throw new NotFoundError(`Resources not found: ${missing.join(", ")}`);
        }
      }

      // 3. Insert service
      const service = await trx
        .insertInto("services")
        .values({
          id: generateId("svc"),
          ledgerId: input.ledgerId,
          policyId: input.policyId ?? null,
          name: input.name ?? null,
          metadata: input.metadata,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      // 4. Insert service_resources
      if (input.resourceIds.length > 0) {
        await trx
          .insertInto("serviceResources")
          .values(input.resourceIds.map((resourceId) => ({ serviceId: service.id, resourceId })))
          .execute();
      }

      return { service, resourceIds: input.resourceIds };
    });
  },
});
