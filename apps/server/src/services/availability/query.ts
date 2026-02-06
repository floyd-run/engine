import { sql } from "kysely";
import { db } from "database";
import { createService } from "lib/service";
import { availability } from "@floyd-run/schema/inputs";
import type { AvailabilityItem, TimelineBlock } from "@floyd-run/schema/types";

interface BlockingAllocation {
  resourceId: string;
  startAt: Date;
  endAt: Date;
}

/**
 * Clamps an interval to the query window [windowStart, windowEnd)
 */
function clampInterval(
  start: Date,
  end: Date,
  windowStart: Date,
  windowEnd: Date,
): { start: Date; end: Date } {
  return {
    start: start < windowStart ? windowStart : start,
    end: end > windowEnd ? windowEnd : end,
  };
}

/**
 * Merges overlapping or adjacent intervals.
 * Input must be sorted by start time.
 */
function mergeIntervals(intervals: { start: Date; end: Date }[]): { start: Date; end: Date }[] {
  if (intervals.length === 0) return [];

  const merged: { start: Date; end: Date }[] = [];
  let current = { ...intervals[0]! };

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i]!;
    if (next.start <= current.end) {
      // Overlapping or adjacent - extend current
      if (next.end > current.end) {
        current.end = next.end;
      }
    } else {
      // Gap - push current and start new
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Builds a timeline of free/busy blocks from merged busy intervals.
 * Guarantees: sequential, non-overlapping, covers full window, no adjacent same-status.
 */
function buildTimeline(
  busyIntervals: { start: Date; end: Date }[],
  windowStart: Date,
  windowEnd: Date,
): TimelineBlock[] {
  const timeline: TimelineBlock[] = [];
  let cursor = windowStart;

  for (const busy of busyIntervals) {
    // Add free block before this busy interval (if gap exists)
    if (busy.start > cursor) {
      timeline.push({
        startAt: cursor.toISOString(),
        endAt: busy.start.toISOString(),
        status: "free",
      });
    }

    // Add busy block
    timeline.push({
      startAt: busy.start.toISOString(),
      endAt: busy.end.toISOString(),
      status: "busy",
    });

    cursor = busy.end;
  }

  // Add trailing free block if window extends past last busy
  if (cursor < windowEnd) {
    timeline.push({
      startAt: cursor.toISOString(),
      endAt: windowEnd.toISOString(),
      status: "free",
    });
  }

  return timeline;
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

      // Clamp allocations to window
      const clamped = allocations.map((a) => clampInterval(a.startAt, a.endAt, startAt, endAt));

      // Merge overlapping/adjacent intervals
      const merged = mergeIntervals(clamped);

      // Build timeline with free/busy blocks
      const timeline = buildTimeline(merged, startAt, endAt);

      return { resourceId, timeline };
    });

    return { items };
  },
});
