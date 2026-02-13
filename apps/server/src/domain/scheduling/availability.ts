/**
 * Service availability — shared pipeline + endpoint-specific generators.
 *
 * resolveDay: extracts per-day policy resolution (steps 1-4 of evaluatePolicy)
 * generateSlots: discrete grid-aligned time positions for appointment-style flows
 * computeWindows: continuous available time ranges for rental-style flows
 */

import {
  type PolicyConfig,
  type ResolvedConfig,
  type DurationConfig,
  type GridConfig,
  type LeadTimeConfig,
  type BuffersConfig,
  type HoldConfig,
  matchesCondition,
  timeToMs,
  toLocalDate,
  getDayOfWeek,
  dateRange,
} from "domain/policy/evaluate";
import { mergeIntervals, type Interval } from "./timeline";

export interface ResolvedDay {
  date: string;
  windows: { startMs: number; endMs: number }[];
  config: ResolvedConfig;
}

export interface BlockingAllocation {
  resourceId: string;
  startTime: Date;
  endTime: Date;
}

export interface SlotResult {
  startTime: string;
  endTime: string;
  status?: "available" | "unavailable";
}

export interface WindowResult {
  startTime: string;
  endTime: string;
  status?: "available" | "unavailable";
}

// ─── Day Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve a single day against a policy config.
 * Extracts steps 1-4 from evaluatePolicy: blackout check, rule matching,
 * open/closed, config resolution.
 *
 * Returns null if the day is closed (blackout, default closed, or closed rule).
 */
export function resolveDay(
  policy: PolicyConfig | null,
  dateStr: string,
  dayOfWeek: string,
): ResolvedDay | null {
  // No policy → fully open, no constraints
  if (!policy) {
    return {
      date: dateStr,
      windows: [{ startMs: 0, endMs: 24 * 60 * 60_000 }],
      config: {},
    };
  }

  const rules = policy.rules ?? [];

  // Step 1: Blackout check — any closed rule matching this date
  for (const rule of rules) {
    if (rule.closed !== true) continue;
    if (matchesCondition(rule.match, dateStr, dayOfWeek)) {
      return null;
    }
  }

  // Step 2: Rule matching — first non-closed rule that matches
  let matchedRule: (typeof rules)[number] | null = null;
  for (const rule of rules) {
    if (rule.closed === true) continue;
    if (matchesCondition(rule.match, dateStr, dayOfWeek)) {
      matchedRule = rule;
      break;
    }
  }

  // Step 3: Open/closed determination
  if (matchedRule) {
    if (matchedRule.windows && matchedRule.windows.length > 0) {
      // Rule has windows — use them
      const windows = matchedRule.windows.map((w) => ({
        startMs: timeToMs(w.start),
        endMs: timeToMs(w.end),
      }));

      // Step 4: Config resolution
      const baseConfig = (policy.config ?? {}) as Record<string, unknown>;
      const ruleConfig = (matchedRule.config ?? {}) as Record<string, unknown>;
      const resolvedRaw = { ...baseConfig, ...ruleConfig };
      const config: ResolvedConfig = {
        duration: resolvedRaw["duration"] as DurationConfig | undefined,
        grid: resolvedRaw["grid"] as GridConfig | undefined,
        lead_time: resolvedRaw["lead_time"] as LeadTimeConfig | undefined,
        buffers: resolvedRaw["buffers"] as BuffersConfig | undefined,
        hold: resolvedRaw["hold"] as HoldConfig | undefined,
      };

      return { date: dateStr, windows, config };
    }
    // No windows on matched rule → day is open 24h
  } else {
    // No rule matched → use default
    if (policy.default === "closed") {
      return null;
    }
    // default: "open" → proceed with 24h
  }

  // Open 24h (matched rule without windows, or default "open" with no matching rule)
  const baseConfig = (policy.config ?? {}) as Record<string, unknown>;
  const ruleConfig = (matchedRule?.config ?? {}) as Record<string, unknown>;
  const resolvedRaw = { ...baseConfig, ...ruleConfig };
  const config: ResolvedConfig = {
    duration: resolvedRaw["duration"] as DurationConfig | undefined,
    grid: resolvedRaw["grid"] as GridConfig | undefined,
    lead_time: resolvedRaw["lead_time"] as LeadTimeConfig | undefined,
    buffers: resolvedRaw["buffers"] as BuffersConfig | undefined,
    hold: resolvedRaw["hold"] as HoldConfig | undefined,
  };

  return {
    date: dateStr,
    windows: [{ startMs: 0, endMs: 24 * 60 * 60_000 }],
    config,
  };
}

/**
 * Resolve all days in a date range against a policy.
 */
export function resolveServiceDays(
  policy: PolicyConfig | null,
  startTime: Date,
  endTime: Date,
  timezone: string,
): ResolvedDay[] {
  const startDate = toLocalDate(startTime, timezone);
  const endInstant = new Date(endTime.getTime() - 1);
  const endDate = toLocalDate(endInstant, timezone);
  const dates = dateRange(startDate, endDate);

  const days: ResolvedDay[] = [];
  for (const dateStr of dates) {
    const dayOfWeek = getDayOfWeek(dateStr);
    const resolved = resolveDay(policy, dateStr, dayOfWeek);
    if (resolved) {
      days.push(resolved);
    }
  }
  return days;
}

// ─── Timezone Conversion ─────────────────────────────────────────────────────

/**
 * Convert a local date string (YYYY-MM-DD) + ms-since-midnight to an absolute Date.
 * Handles DST transitions correctly.
 */
export function localToAbsolute(dateStr: string, msFromMidnight: number, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const hours = Math.floor(msFromMidnight / 3_600_000);
  const remaining = msFromMidnight % 3_600_000;
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const ms = remaining % 1_000;

  // Handle 24:00 → next day 00:00
  if (hours >= 24) {
    const nextDay = new Date(Date.UTC(year!, month! - 1, day! + 1));
    const nextDateStr = `${nextDay.getUTCFullYear()}-${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;
    return localToAbsolute(nextDateStr, msFromMidnight - 24 * 3_600_000, timezone);
  }

  // Build an ISO-like string in the target timezone
  // Use Intl.DateTimeFormat to resolve the UTC offset for this local time
  // Create roughUtc with only hours:minutes to avoid double-counting seconds/ms
  const roughUtcStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00.000Z`;

  // Create a rough UTC estimate, then adjust for timezone offset
  const roughUtc = new Date(roughUtcStr);

  // Get the timezone offset at this rough time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Binary-search style: find the UTC instant that corresponds to this local time
  // Start with rough estimate and refine
  const parts = formatter.formatToParts(roughUtc);
  const localHour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const localMinute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const localDay = parseInt(parts.find((p) => p.type === "day")!.value);
  const localMonth = parseInt(parts.find((p) => p.type === "month")!.value);

  // Compute the difference between what we wanted and what we got
  const roughLocalMs = localHour * 3_600_000 + localMinute * 60_000;
  const wantedLocalMs = hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + ms;

  // Day difference handling
  let dayDiffMs = 0;
  if (localDay !== day || localMonth !== month) {
    // Rough UTC landed on a different local day — calculate day offset
    const wantedDate = new Date(Date.UTC(year!, month! - 1, day!));
    const gotDate = new Date(Date.UTC(roughUtc.getUTCFullYear(), localMonth - 1, localDay));
    dayDiffMs = wantedDate.getTime() - gotDate.getTime();
  }

  const offsetMs = wantedLocalMs - roughLocalMs + dayDiffMs;
  return new Date(roughUtc.getTime() + offsetMs);
}

// ─── Slot Generation ─────────────────────────────────────────────────────────

function isDurationValid(durationMs: number, config: ResolvedConfig): boolean {
  const dur = config.duration as DurationConfig | undefined;
  if (!dur) return true;

  if (dur.allowed_ms && dur.allowed_ms.length > 0) {
    return dur.allowed_ms.includes(durationMs);
  }

  if (dur.min_ms !== undefined && durationMs < dur.min_ms) return false;
  if (dur.max_ms !== undefined && durationMs > dur.max_ms) return false;
  return true;
}

function overlapsAny(
  start: number,
  end: number,
  allocations: { start: number; end: number }[],
): boolean {
  for (const allocation of allocations) {
    if (start < allocation.end && end > allocation.start) return true;
  }
  return false;
}

/**
 * Generate discrete grid-aligned slots for a resource.
 */
export function generateSlots(
  resolvedDays: ResolvedDay[],
  allocations: BlockingAllocation[],
  durationMs: number,
  serverTime: Date,
  timezone: string,
  includeUnavailable: boolean,
  queryStart: Date,
  queryEnd: Date,
): SlotResult[] {
  const serverTimeMs = serverTime.getTime();
  const queryStartMs = queryStart.getTime();
  const queryEndMs = queryEnd.getTime();

  // Pre-convert allocations to ms timestamps for fast comparison
  const allocMs = allocations.map((a) => ({
    start: a.startTime.getTime(),
    end: a.endTime.getTime(),
  }));

  const slots: SlotResult[] = [];

  for (const day of resolvedDays) {
    // Skip day if duration is invalid for this day's config
    if (!isDurationValid(durationMs, day.config)) continue;

    const gridInterval = (day.config.grid as GridConfig | undefined)?.interval_ms ?? durationMs;
    const beforeMs = (day.config.buffers as BuffersConfig | undefined)?.before_ms ?? 0;
    const afterMs = (day.config.buffers as BuffersConfig | undefined)?.after_ms ?? 0;
    const minLeadMs = (day.config.lead_time as LeadTimeConfig | undefined)?.min_ms;
    const maxLeadMs = (day.config.lead_time as LeadTimeConfig | undefined)?.max_ms;

    for (const window of day.windows) {
      // Generate candidates at grid steps within this window
      for (
        let startMs = window.startMs;
        startMs + durationMs <= window.endMs;
        startMs += gridInterval
      ) {
        const candidateStart = localToAbsolute(day.date, startMs, timezone);
        const candidateEnd = localToAbsolute(day.date, startMs + durationMs, timezone);

        const candidateStartMs = candidateStart.getTime();
        const candidateEndMs = candidateEnd.getTime();

        // Skip candidates outside query range
        if (candidateStartMs < queryStartMs || candidateEndMs > queryEndMs) continue;

        // Check if slot is available
        let available = true;

        // Buffer-expanded conflict check
        const effectiveStart = candidateStartMs - beforeMs;
        const effectiveEnd = candidateEndMs + afterMs;
        if (overlapsAny(effectiveStart, effectiveEnd, allocMs)) {
          available = false;
        }

        // Lead time check
        if (available && minLeadMs !== undefined) {
          const leadTime = candidateStartMs - serverTimeMs;
          if (leadTime < minLeadMs) available = false;
        }

        // Horizon check
        if (available && maxLeadMs !== undefined) {
          const leadTime = candidateStartMs - serverTimeMs;
          if (leadTime > maxLeadMs) available = false;
        }

        if (available) {
          const slot: SlotResult = {
            startTime: candidateStart.toISOString(),
            endTime: candidateEnd.toISOString(),
          };
          if (includeUnavailable) slot.status = "available";
          slots.push(slot);
        } else if (includeUnavailable) {
          slots.push({
            startTime: candidateStart.toISOString(),
            endTime: candidateEnd.toISOString(),
            status: "unavailable",
          });
        }
      }
    }
  }

  return slots;
}

// ─── Window Computation ──────────────────────────────────────────────────────

/**
 * Subtract busy intervals from free intervals.
 * Returns the remaining free portions.
 */
function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  const result: Interval[] = [];

  for (const f of free) {
    let remaining: Interval[] = [
      { start: new Date(f.start.getTime()), end: new Date(f.end.getTime()) },
    ];

    for (const b of busy) {
      const next: Interval[] = [];
      for (const r of remaining) {
        // No overlap
        if (b.start >= r.end || b.end <= r.start) {
          next.push(r);
          continue;
        }
        // Left portion
        if (b.start > r.start) {
          next.push({ start: r.start, end: b.start });
        }
        // Right portion
        if (b.end < r.end) {
          next.push({ start: b.end, end: r.end });
        }
      }
      remaining = next;
    }

    result.push(...remaining);
  }

  return result;
}

/**
 * Compute continuous available time windows for a resource.
 */
export function computeWindows(
  resolvedDays: ResolvedDay[],
  allocations: BlockingAllocation[],
  serverTime: Date,
  timezone: string,
  includeUnavailable: boolean,
  queryStart: Date,
  queryEnd: Date,
): WindowResult[] {
  const serverTimeMs = serverTime.getTime();

  // Convert allocations to Interval format
  const busyIntervals: Interval[] = allocations.map((a) => ({
    start: a.startTime,
    end: a.endTime,
  }));

  // Step 1-2: Convert schedule windows to absolute intervals, clamped to query range
  const scheduleIntervals: Interval[] = [];
  // Track per-day config for buffer/lead/horizon/min-duration (use first day's config as base)
  // Since config can vary per day, we need to process per-day
  const dayConfigs: { interval: Interval; config: ResolvedConfig }[] = [];

  for (const day of resolvedDays) {
    for (const window of day.windows) {
      let start = localToAbsolute(day.date, window.startMs, timezone);
      let end = localToAbsolute(day.date, window.endMs, timezone);

      // Clamp to query range
      if (start < queryStart) start = queryStart;
      if (end > queryEnd) end = queryEnd;
      if (start >= end) continue;

      const interval: Interval = { start, end };
      scheduleIntervals.push(interval);
      dayConfigs.push({ interval, config: day.config });
    }
  }

  if (scheduleIntervals.length === 0) {
    return [];
  }

  // Sort and merge schedule intervals (handles contiguous cross-day windows)
  const sortedSchedule = [...scheduleIntervals].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );
  const mergedSchedule = mergeIntervals(sortedSchedule);

  // Sort busy intervals
  const sortedBusy = [...busyIntervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const mergedBusy = mergeIntervals(sortedBusy);

  // Step 3: Subtract allocations from schedule windows
  const gapIntervals = subtractIntervals(mergedSchedule, mergedBusy);

  // Determine config for each gap — use the config of the first overlapping day window
  function getConfigForTime(timeMs: number): ResolvedConfig {
    for (const dc of dayConfigs) {
      if (timeMs >= dc.interval.start.getTime() && timeMs < dc.interval.end.getTime()) {
        return dc.config;
      }
    }
    // Fallback to first day config
    return dayConfigs[0]?.config ?? {};
  }

  // Step 4: Apply asymmetric buffer shrinkage
  const availableWindows: Interval[] = [];
  for (const gap of gapIntervals) {
    const config = getConfigForTime(gap.start.getTime());
    const beforeMs = (config.buffers as BuffersConfig | undefined)?.before_ms ?? 0;
    const afterMs = (config.buffers as BuffersConfig | undefined)?.after_ms ?? 0;

    let shrunkStart = gap.start.getTime();
    let shrunkEnd = gap.end.getTime();

    // Check if gap start is adjacent to an allocation (not a schedule boundary)
    const isStartAdjacentToAlloc = mergedBusy.some((b) => b.end.getTime() === gap.start.getTime());
    if (isStartAdjacentToAlloc) {
      shrunkStart += beforeMs;
    }

    // Check if gap end is adjacent to an allocation (not a schedule boundary)
    const isEndAdjacentToAlloc = mergedBusy.some((b) => b.start.getTime() === gap.end.getTime());
    if (isEndAdjacentToAlloc) {
      shrunkEnd -= afterMs;
    }

    if (shrunkStart >= shrunkEnd) continue;

    availableWindows.push({
      start: new Date(shrunkStart),
      end: new Date(shrunkEnd),
    });
  }

  // Step 5: Discard windows shorter than min_ms
  const filteredWindows = availableWindows.filter((w) => {
    const config = getConfigForTime(w.start.getTime());
    const minMs = (config.duration as DurationConfig | undefined)?.min_ms;
    if (minMs === undefined) return true;
    return w.end.getTime() - w.start.getTime() >= minMs;
  });

  // Step 6: Filter by lead time and horizon
  const leadFiltered = filteredWindows.filter((w) => {
    const config = getConfigForTime(w.start.getTime());
    const ltConfig = config.lead_time as LeadTimeConfig | undefined;

    // For windows, we check if the window START is within the lead time window
    const leadTime = w.start.getTime() - serverTimeMs;

    if (ltConfig?.min_ms !== undefined && leadTime < ltConfig.min_ms) {
      // Trim the window start to meet lead time, rather than discarding entirely
      const minStart = serverTimeMs + ltConfig.min_ms;
      if (minStart < w.end.getTime()) {
        w.start = new Date(minStart);
      } else {
        return false;
      }
    }

    if (ltConfig?.max_ms !== undefined) {
      const maxStart = serverTimeMs + ltConfig.max_ms;
      if (w.start.getTime() > maxStart) return false;
      // Trim end if needed
      if (w.end.getTime() > maxStart) {
        w.end = new Date(maxStart);
      }
    }

    return true;
  });

  // Post-trim validation: re-check min_ms since trimming may have shrunk windows
  const validWindows = leadFiltered.filter((w) => {
    const durationMs = w.end.getTime() - w.start.getTime();

    // Discard zero-length windows
    if (durationMs === 0) return false;

    // Re-check duration constraints after trimming
    const config = getConfigForTime(w.start.getTime());
    const minMs = (config.duration as DurationConfig | undefined)?.min_ms;
    return minMs === undefined || durationMs >= minMs;
  });

  // Step 7: Merge contiguous windows
  const sortedFiltered = [...validWindows].sort((a, b) => a.start.getTime() - b.start.getTime());
  const finalWindows = mergeIntervals(sortedFiltered);

  // Build results
  const results: WindowResult[] = [];

  if (includeUnavailable) {
    // Step 8: Return both available and unavailable within schedule hours
    // Unavailable = allocation effective times within schedule
    const unavailableInSchedule = busyIntervalsWithinSchedule(mergedBusy, mergedSchedule);

    // Combine and sort all intervals
    const allEntries: { interval: Interval; status: "available" | "unavailable" }[] = [
      ...finalWindows.map((w) => ({ interval: w, status: "available" as const })),
      ...unavailableInSchedule.map((w) => ({ interval: w, status: "unavailable" as const })),
    ];
    allEntries.sort((a, b) => a.interval.start.getTime() - b.interval.start.getTime());

    for (const entry of allEntries) {
      results.push({
        startTime: entry.interval.start.toISOString(),
        endTime: entry.interval.end.toISOString(),
        status: entry.status,
      });
    }
  } else {
    for (const w of finalWindows) {
      results.push({
        startTime: w.start.toISOString(),
        endTime: w.end.toISOString(),
      });
    }
  }

  return results;
}

/**
 * Get busy intervals clamped to within schedule hours.
 */
function busyIntervalsWithinSchedule(busy: Interval[], schedule: Interval[]): Interval[] {
  const result: Interval[] = [];

  for (const b of busy) {
    for (const s of schedule) {
      // Find overlap between busy and schedule
      const overlapStart = b.start > s.start ? b.start : s.start;
      const overlapEnd = b.end < s.end ? b.end : s.end;

      if (overlapStart < overlapEnd) {
        result.push({ start: overlapStart, end: overlapEnd });
      }
    }
  }

  return mergeIntervals(result.sort((a, b) => a.start.getTime() - b.start.getTime()));
}
