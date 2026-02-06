import { sql } from "kysely";
import { db } from "database";
import { createService } from "lib/service";
import { availability } from "@floyd-run/schema/inputs";
import type { AvailabilityItem } from "@floyd-run/schema/types";
import { clampInterval, mergeIntervals, buildTimeline } from "lib/timeline";

interface BlockingAllocation {
  resourceId: string;
  startAt: Date;
  endAt: Date;
}

export default createService({
  input: availability.querySchema,
  execute: async (input): Promise<{ items: AvailabilityItem[] }> => {
    const { ledgerId, resourceIds, startAt, endAt } = input;

    // Single query to fetch all blocking allocations
    const blockingAllocations = await sql<BlockingAllocation>`
      SELECT resource_id, start_at, end_at
      FROM allocations
      WHERE ledger_id = ${ledgerId}
        AND resource_id = ANY(${sql.raw(`ARRAY[${resourceIds.map((id) => `'${id}'`).join(",")}]::text[]`)})
        AND status IN ('hold', 'confirmed')
        AND (status != 'hold' OR expires_at > clock_timestamp())
        AND start_at < ${endAt}
        AND end_at > ${startAt}
      ORDER BY resource_id, start_at
    `.execute(db);

    // Group allocations by resource_id
    const allocationsByResource = new Map<string, BlockingAllocation[]>();
    for (const resourceId of resourceIds) {
      allocationsByResource.set(resourceId, []);
    }
    for (const row of blockingAllocations.rows) {
      const list = allocationsByResource.get(row.resourceId);
      if (list) {
        list.push(row);
      }
    }

    // Build timeline for each resource
    const items: AvailabilityItem[] = resourceIds.map((resourceId) => {
      const allocations = allocationsByResource.get(resourceId) || [];

      // Clamp allocations to window, merge overlaps, build timeline
      const clamped = allocations.map((a) =>
        clampInterval({ start: a.startAt, end: a.endAt }, startAt, endAt),
      );
      const merged = mergeIntervals(clamped);
      const timeline = buildTimeline(merged, startAt, endAt);

      return { resourceId, timeline };
    });

    return { items };
  },
});
