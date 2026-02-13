import type { TimelineBlock } from "@floyd-run/schema/types";

export interface Interval {
  start: Date;
  end: Date;
}

/**
 * Clamps an interval to the query window [windowStart, windowEnd)
 */
export function clampInterval(interval: Interval, windowStart: Date, windowEnd: Date): Interval {
  return {
    start: interval.start < windowStart ? windowStart : interval.start,
    end: interval.end > windowEnd ? windowEnd : interval.end,
  };
}

/**
 * Merges overlapping or adjacent intervals.
 * Input must be sorted by start time.
 */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const merged: Interval[] = [];
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
export function buildTimeline(
  busyIntervals: Interval[],
  windowStart: Date,
  windowEnd: Date,
): TimelineBlock[] {
  const timeline: TimelineBlock[] = [];
  let cursor = windowStart;

  for (const busy of busyIntervals) {
    // Add free block before this busy interval (if gap exists)
    if (busy.start > cursor) {
      timeline.push({
        startTime: cursor.toISOString(),
        endTime: busy.start.toISOString(),
        status: "free",
      });
    }

    // Add busy block
    timeline.push({
      startTime: busy.start.toISOString(),
      endTime: busy.end.toISOString(),
      status: "busy",
    });

    cursor = busy.end;
  }

  // Add trailing free block if window extends past last busy
  if (cursor < windowEnd) {
    timeline.push({
      startTime: cursor.toISOString(),
      endTime: windowEnd.toISOString(),
      status: "free",
    });
  }

  return timeline;
}
