import { db } from "database";
import { createOperation } from "lib/operation";
import { serviceInput } from "@floyd-run/schema/inputs";
import { NotFoundError } from "lib/errors";

export default createOperation({
  input: serviceInput.update,
  execute: async (input) => {
    return await db.transaction().execute(async (trx) => {
      // 1. Lock service row
      const existing = await trx
        .selectFrom("services")
        .selectAll()
        .where("id", "=", input.id)
        .where("ledgerId", "=", input.ledgerId)
        .forUpdate()
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError("Service not found");
      }

      // 2. Validate policyId (if provided)
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

      // 3. Validate all resourceIds exist and belong to same ledger
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

      // 4. Update service row
      const service = await trx
        .updateTable("services")
        .set({
          name: input.name,
          policyId: input.policyId ?? null,
          metadata: input.metadata ?? null,
        })
        .where("id", "=", input.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // 5. Replace service_resources (delete all, re-insert)
      await trx.deleteFrom("serviceResources").where("serviceId", "=", input.id).execute();

      if (input.resourceIds.length > 0) {
        await trx
          .insertInto("serviceResources")
          .values(input.resourceIds.map((resourceId) => ({ serviceId: input.id, resourceId })))
          .execute();
      }

      return { service, resourceIds: input.resourceIds };
    });
  },
});
