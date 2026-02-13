import { sql } from "kysely";
import { db } from "database";
import { createOperation } from "lib/operation";
import { availabilityInput } from "@floyd-run/schema/inputs";
import type { AvailabilityItem } from "@floyd-run/schema/types";
import { clampInterval, mergeIntervals, buildTimeline } from "domain/scheduling/timeline";

interface BlockingAllocation {
  resourceId: string;
  startTime: Date;
  endTime: Date;
}

export default createOperation({
  input: availabilityInput.query,
  execute: async (input): Promise<{ items: AvailabilityItem[] }> => {
    const { ledgerId, resourceIds, startTime, endTime } = input;

    // Single query to fetch all blocking allocations
    const blockingAllocations = await sql<BlockingAllocation>`
      SELECT resource_id, start_time, end_time
      FROM allocations
      WHERE ledger_id = ${ledgerId}
        AND resource_id = ANY(ARRAY[${sql.join(resourceIds.map((id) => sql`${id}`))}]::text[])
        AND active = true
        AND (expires_at IS NULL OR expires_at > clock_timestamp())
        AND start_time < ${endTime}
        AND end_time > ${startTime}
      ORDER BY resource_id, start_time
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
        clampInterval({ start: a.startTime, end: a.endTime }, startTime, endTime),
      );
      const merged = mergeIntervals(clamped);
      const timeline = buildTimeline(merged, startTime, endTime);

      return { resourceId, timeline };
    });

    return { items };
  },
});
