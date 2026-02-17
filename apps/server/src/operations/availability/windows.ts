import { sql } from "kysely";
import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { availabilityInput } from "@floyd-run/schema/inputs";
import { InputError, NotFoundError } from "lib/errors";
import { resolveServiceDays, computeWindows } from "domain/scheduling/availability";
import type { PolicyConfig } from "domain/policy/evaluate";
import type { BlockingAllocation } from "domain/scheduling/availability";

const MAX_WINDOWS_RANGE_MS = 31 * 24 * 60 * 60_000; // 31 days

export default createOperation({
  input: availabilityInput.windows,
  execute: async (input) => {
    const { ledgerId, serviceId, startTime, endTime, includeUnavailable } = input;

    // Validate query window
    if (endTime.getTime() - startTime.getTime() > MAX_WINDOWS_RANGE_MS) {
      throw new InputError([
        { code: "custom", message: "Query range exceeds maximum of 31 days", path: ["endTime"] },
      ]);
    }

    if (endTime <= startTime) {
      throw new InputError([
        { code: "custom", message: "endTime must be after startTime", path: ["endTime"] },
      ]);
    }

    // 1. Load service
    const service = await db
      .selectFrom("services")
      .selectAll()
      .where("id", "=", serviceId)
      .where("ledgerId", "=", ledgerId)
      .executeTakeFirst();

    if (!service) throw new NotFoundError("Service not found");

    // 2. Load service's resources
    const serviceResourceRows = await db
      .selectFrom("serviceResources")
      .select("resourceId")
      .where("serviceId", "=", serviceId)
      .execute();

    const allServiceResourceIds = new Set(serviceResourceRows.map((r) => r.resourceId));

    let targetResourceIds: string[];
    if (input.resourceIds && input.resourceIds.length > 0) {
      for (const rid of input.resourceIds) {
        if (!allServiceResourceIds.has(rid)) {
          throw new InputError([
            {
              code: "custom",
              message: `Resource ${rid} does not belong to service ${serviceId}`,
              path: ["resourceIds"],
            },
          ]);
        }
      }
      targetResourceIds = input.resourceIds;
    } else {
      targetResourceIds = [...allServiceResourceIds];
    }

    if (targetResourceIds.length === 0) {
      const serverTime = await getServerTime(db);
      return { data: [], serverTime };
    }

    // 3. Load resources (for timezone)
    const resources = await db
      .selectFrom("resources")
      .select(["id", "timezone"])
      .where("id", "in", targetResourceIds)
      .execute();

    const resourceMap = new Map(resources.map((r) => [r.id, r]));

    // 4. Capture serverTime
    const serverTime = await getServerTime(db);

    // 5. Load policy config from current version
    let policy: PolicyConfig | null = null;
    if (service.policyId) {
      const policyRow = await db
        .selectFrom("policies")
        .select("currentVersionId")
        .where("id", "=", service.policyId)
        .executeTakeFirst();

      if (policyRow?.currentVersionId) {
        const version = await db
          .selectFrom("policyVersions")
          .select("config")
          .where("id", "=", policyRow.currentVersionId)
          .executeTakeFirstOrThrow();
        policy = version.config as unknown as PolicyConfig;
      }
    }

    // 6. Fetch allocations
    const blockingAllocations =
      targetResourceIds.length > 0
        ? await sql<BlockingAllocation>`
          SELECT resource_id, start_time, end_time
          FROM allocations
          WHERE ledger_id = ${ledgerId}
            AND resource_id = ANY(ARRAY[${sql.join(targetResourceIds.map((id) => sql`${id}`))}]::text[])
            AND active = true
            AND (expires_at IS NULL OR expires_at > clock_timestamp())
            AND start_time < ${endTime}
            AND end_time > ${startTime}
          ORDER BY resource_id, start_time
        `.execute(db)
        : { rows: [] };

    // Group allocations by resource
    const allocByResource = new Map<string, BlockingAllocation[]>();
    for (const id of targetResourceIds) {
      allocByResource.set(id, []);
    }
    for (const row of blockingAllocations.rows) {
      const list = allocByResource.get(row.resourceId);
      if (list) list.push(row);
    }

    // 7. Compute windows per resource
    const data = targetResourceIds.map((resourceId) => {
      const resource = resourceMap.get(resourceId);
      const timezone = resource!.timezone;
      const allocs = allocByResource.get(resourceId) ?? [];

      const resolvedDays = resolveServiceDays(policy, startTime, endTime, timezone);
      const windows = computeWindows(
        resolvedDays,
        allocs,
        serverTime,
        timezone,
        includeUnavailable,
        startTime,
        endTime,
      );

      return { resourceId, timezone, windows };
    });

    return { data, serverTime };
  },
});
