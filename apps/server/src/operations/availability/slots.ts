import { sql } from "kysely";
import { db, getServerTime } from "database";
import { createOperation } from "lib/operation";
import { availability } from "@floyd-run/schema/inputs";
import { InputError, NotFoundError } from "lib/errors";
import { resolveServiceDays, generateSlots } from "domain/scheduling/availability";
import type { PolicyConfig } from "domain/policy/evaluate";
import type { BlockingAllocation } from "domain/scheduling/availability";

const MAX_SLOTS_RANGE_MS = 7 * 24 * 60 * 60_000; // 7 days

export default createOperation({
  input: availability.slotsSchema,
  execute: async (input) => {
    const { ledgerId, serviceId, startAt, endAt, durationMs, includeUnavailable } = input;

    // Validate query window
    if (endAt.getTime() - startAt.getTime() > MAX_SLOTS_RANGE_MS) {
      throw new InputError([
        { code: "custom", message: "Query range exceeds maximum of 7 days", path: ["endAt"] },
      ]);
    }

    if (endAt <= startAt) {
      throw new InputError([
        { code: "custom", message: "endAt must be after startAt", path: ["endAt"] },
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
      // Validate all requested resourceIds belong to the service
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
      return { data: [], serverTime: new Date() };
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

    // 5. Load policy
    let policy: PolicyConfig | null = null;
    if (service.policyId) {
      const policyRow = await db
        .selectFrom("policies")
        .selectAll()
        .where("id", "=", service.policyId)
        .executeTakeFirst();

      if (policyRow) {
        policy = policyRow.config as unknown as PolicyConfig;
      }
    }

    // 6. Fetch allocations
    const blockingAllocations =
      targetResourceIds.length > 0
        ? await sql<BlockingAllocation>`
          SELECT resource_id, start_at, end_at
          FROM allocations
          WHERE ledger_id = ${ledgerId}
            AND resource_id = ANY(ARRAY[${sql.join(targetResourceIds.map((id) => sql`${id}`))}]::text[])
            AND active = true
            AND (expires_at IS NULL OR expires_at > clock_timestamp())
            AND start_at < ${endAt}
            AND end_at > ${startAt}
          ORDER BY resource_id, start_at
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

    // 7. Generate slots per resource
    const data = targetResourceIds.map((resourceId) => {
      const resource = resourceMap.get(resourceId);
      const timezone = resource?.timezone ?? "UTC";
      const allocs = allocByResource.get(resourceId) ?? [];

      const resolvedDays = resolveServiceDays(policy, startAt, endAt, timezone);
      const slots = generateSlots(
        resolvedDays,
        allocs,
        durationMs,
        serverTime,
        timezone,
        includeUnavailable,
        startAt,
        endAt,
      );

      return { resourceId, timezone, slots };
    });

    return { data, serverTime };
  },
});
