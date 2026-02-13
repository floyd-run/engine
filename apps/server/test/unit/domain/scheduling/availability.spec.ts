import { describe, expect, it } from "vitest";
import {
  resolveDay,
  resolveServiceDays,
  localToAbsolute,
  generateSlots,
  computeWindows,
  type ResolvedDay,
  type BlockingAllocation,
} from "domain/scheduling/availability";
import type { PolicyConfig } from "domain/policy/evaluate";

// ─── Constants ──────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const MINUTE = 60_000;
const DAY = 24 * HOUR;

/** Server time far in the past — avoids lead-time filtering in most tests. */
const PAST = new Date("2020-01-01T00:00:00Z");

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePolicy(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return { schema_version: 1, default: "open", config: {}, ...overrides };
}

function makeDay(
  date: string,
  windowPairs: [number, number][],
  config: Record<string, unknown> = {},
): ResolvedDay {
  return {
    date,
    windows: windowPairs.map(([s, e]) => ({ startMs: s, endMs: e })),
    config: config as ResolvedDay["config"],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. localToAbsolute
// ═════════════════════════════════════════════════════════════════════════════

describe("localToAbsolute", () => {
  it("converts midnight UTC", () => {
    expect(localToAbsolute("2026-03-16", 0, "UTC").toISOString()).toBe("2026-03-16T00:00:00.000Z");
  });

  it("converts 09:30 UTC", () => {
    expect(localToAbsolute("2026-03-16", 9 * HOUR + 30 * MINUTE, "UTC").toISOString()).toBe(
      "2026-03-16T09:30:00.000Z",
    );
  });

  it("converts 01:30:30.250 UTC with seconds and milliseconds", () => {
    // Regression test: ensure seconds/ms aren't double-counted
    // 1h 30m 30s 250ms = 5430250ms
    expect(localToAbsolute("2026-01-01", 5430250, "UTC").toISOString()).toBe(
      "2026-01-01T01:30:30.250Z",
    );
  });

  it("handles 24:00 → next day 00:00", () => {
    expect(localToAbsolute("2026-03-16", 24 * HOUR, "UTC").toISOString()).toBe(
      "2026-03-17T00:00:00.000Z",
    );
  });

  it("converts America/New_York EST (before spring forward)", () => {
    // 2026-03-02 is EST = UTC-5. 09:00 local = 14:00 UTC
    expect(localToAbsolute("2026-03-02", 9 * HOUR, "America/New_York").toISOString()).toBe(
      "2026-03-02T14:00:00.000Z",
    );
  });

  it("converts America/New_York EDT (after spring forward)", () => {
    // 2026-03-16 is EDT = UTC-4. 09:00 local = 13:00 UTC
    expect(localToAbsolute("2026-03-16", 9 * HOUR, "America/New_York").toISOString()).toBe(
      "2026-03-16T13:00:00.000Z",
    );
  });

  it("DST spring forward: 2:30 AM gap resolves to 3:30 AM EDT", () => {
    // 2026-03-08 spring forward: 2:00 AM EST → 3:00 AM EDT (at 07:00 UTC)
    // 2:30 AM local doesn't exist → pushed forward 1 hour → 3:30 AM EDT = 07:30 UTC
    expect(
      localToAbsolute("2026-03-08", 2 * HOUR + 30 * MINUTE, "America/New_York").toISOString(),
    ).toBe("2026-03-08T07:30:00.000Z");
  });

  it("DST fall back: 1:30 AM resolves to first occurrence (EDT)", () => {
    // 2026-11-01 fall back: 2:00 AM EDT → 1:00 AM EST (at 06:00 UTC)
    // 1:30 AM ambiguous — algorithm resolves to EDT (first occurrence)
    // 1:30 AM EDT = 05:30 UTC
    expect(
      localToAbsolute("2026-11-01", 1 * HOUR + 30 * MINUTE, "America/New_York").toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("converts Europe/London BST correctly", () => {
    // 2026-03-29 is after UK spring forward (Mar 29). BST = UTC+1.
    // 10:00 local = 09:00 UTC
    expect(localToAbsolute("2026-03-30", 10 * HOUR, "Europe/London").toISOString()).toBe(
      "2026-03-30T09:00:00.000Z",
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. resolveDay
// ═════════════════════════════════════════════════════════════════════════════

describe("resolveDay", () => {
  it("no policy → 24h open with empty config", () => {
    const result = resolveDay(null, "2026-03-16", "monday");
    expect(result).toEqual({
      date: "2026-03-16",
      windows: [{ startMs: 0, endMs: DAY }],
      config: {},
    });
  });

  it("default open, no rules → 24h open with base config", () => {
    const policy = makePolicy({ config: { duration: { min_ms: HOUR } } });
    const result = resolveDay(policy, "2026-03-16", "monday");

    expect(result).not.toBeNull();
    expect(result!.windows).toEqual([{ startMs: 0, endMs: DAY }]);
    expect(result!.config.duration).toEqual({ min_ms: HOUR });
  });

  it("default closed, no rules → null", () => {
    const result = resolveDay(makePolicy({ default: "closed" }), "2026-03-16", "monday");
    expect(result).toBeNull();
  });

  it("blackout date → null", () => {
    const policy = makePolicy({
      rules: [{ match: { type: "date", date: "2026-03-16" }, closed: true }],
    });
    expect(resolveDay(policy, "2026-03-16", "monday")).toBeNull();
  });

  it("blackout does not match different date", () => {
    const policy = makePolicy({
      rules: [{ match: { type: "date", date: "2026-03-17" }, closed: true }],
    });
    expect(resolveDay(policy, "2026-03-16", "monday")).not.toBeNull();
  });

  it("matching weekly rule with windows → returns windows + merged config", () => {
    const policy = makePolicy({
      default: "closed",
      config: { grid: { interval_ms: 30 * MINUTE } },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
          config: { duration: { allowed_ms: [HOUR] } },
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;

    expect(result.windows).toEqual([{ startMs: 9 * HOUR, endMs: 17 * HOUR }]);
    expect(result.config.grid).toEqual({ interval_ms: 30 * MINUTE });
    expect(result.config.duration).toEqual({ allowed_ms: [HOUR] });
  });

  it("matching rule without windows → 24h open", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [{ match: { type: "weekly", days: ["monday"] } }],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;
    expect(result.windows).toEqual([{ startMs: 0, endMs: DAY }]);
  });

  it("first-match-wins: earlier rule takes precedence", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "12:00" }],
        },
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;
    expect(result.windows).toEqual([{ startMs: 9 * HOUR, endMs: 12 * HOUR }]);
  });

  it("closed rule is skipped in step 2 (rule resolution)", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        { match: { type: "date", date: "2026-03-17" }, closed: true },
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;
    expect(result.windows).toEqual([{ startMs: 9 * HOUR, endMs: 17 * HOUR }]);
  });

  it("multiple windows on matched rule", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [
            { start: "09:00", end: "12:00" },
            { start: "14:00", end: "18:00" },
          ],
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;
    expect(result.windows).toEqual([
      { startMs: 9 * HOUR, endMs: 12 * HOUR },
      { startMs: 14 * HOUR, endMs: 18 * HOUR },
    ]);
  });

  it("rule config overrides base config at section level", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 2 * HOUR },
        buffers: { before_ms: 10 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          config: { duration: { allowed_ms: [HOUR] } },
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;

    // Duration fully replaced by rule config
    expect(result.config.duration).toEqual({ allowed_ms: [HOUR] });
    // Buffers preserved from base
    expect(result.config.buffers).toEqual({ before_ms: 10 * MINUTE });
  });

  it("unmatched day with default open → 24h + base config", () => {
    const policy = makePolicy({
      default: "open",
      config: { buffers: { after_ms: 5 * MINUTE } },
      rules: [
        {
          match: { type: "weekly", days: ["tuesday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    const result = resolveDay(policy, "2026-03-16", "monday")!;
    expect(result.windows).toEqual([{ startMs: 0, endMs: DAY }]);
    expect(result.config.buffers).toEqual({ after_ms: 5 * MINUTE });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. resolveServiceDays
// ═════════════════════════════════════════════════════════════════════════════

describe("resolveServiceDays", () => {
  it("single day range", () => {
    const days = resolveServiceDays(
      null,
      new Date("2026-03-16T00:00:00Z"),
      new Date("2026-03-16T23:59:59Z"),
      "UTC",
    );
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-03-16");
  });

  it("multi-day range with mixed open/closed", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday", "wednesday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Mon Mar 16 through Fri Mar 20 (Mon, Tue, Wed, Thu, Fri)
    const days = resolveServiceDays(
      policy,
      new Date("2026-03-16T00:00:00Z"),
      new Date("2026-03-21T00:00:00Z"),
      "UTC",
    );
    expect(days).toHaveLength(2);
    expect(days[0]!.date).toBe("2026-03-16"); // Monday
    expect(days[1]!.date).toBe("2026-03-18"); // Wednesday
  });

  it("timezone affects which dates are included", () => {
    // 2026-03-16T03:00:00Z → UTC: Mar 16, New York (EDT -4): Mar 15 23:00
    const start = new Date("2026-03-16T03:00:00Z");
    const end = new Date("2026-03-16T05:00:00Z");

    const daysUTC = resolveServiceDays(null, start, end, "UTC");
    const daysNY = resolveServiceDays(null, start, end, "America/New_York");

    expect(daysUTC).toHaveLength(1);
    expect(daysUTC[0]!.date).toBe("2026-03-16");

    // NY: spans Mar 15 (23:00) to Mar 16 (01:00) → two dates
    expect(daysNY).toHaveLength(2);
    expect(daysNY[0]!.date).toBe("2026-03-15");
    expect(daysNY[1]!.date).toBe("2026-03-16");
  });

  it("no policy → all days returned as 24h open", () => {
    const days = resolveServiceDays(
      null,
      new Date("2026-03-16T00:00:00Z"),
      new Date("2026-03-18T23:59:59Z"),
      "UTC",
    );
    expect(days).toHaveLength(3);
    for (const day of days) {
      expect(day.windows).toEqual([{ startMs: 0, endMs: DAY }]);
      expect(day.config).toEqual({});
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. generateSlots
// ═════════════════════════════════════════════════════════════════════════════

describe("generateSlots", () => {
  const Q = { start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:00:00Z") };

  it("generates grid-aligned slots within window", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 12 * HOUR]], {
      grid: { interval_ms: 30 * MINUTE },
    });
    const slots = generateSlots([day], [], HOUR, PAST, "UTC", false, Q.start, Q.end);

    // 60min slots at 30min grid on 09:00-12:00: 09:00, 09:30, 10:00, 10:30, 11:00
    expect(slots).toHaveLength(5);
    expect(slots[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(slots[4]!.startTime).toBe("2026-03-16T11:00:00.000Z");
    expect(slots[4]!.endTime).toBe("2026-03-16T12:00:00.000Z");
  });

  it("no grid → step = durationMs (non-overlapping)", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 13 * HOUR]]);
    const slots = generateSlots([day], [], HOUR, PAST, "UTC", false, Q.start, Q.end);

    expect(slots).toHaveLength(4);
    expect(slots[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(slots[3]!.startTime).toBe("2026-03-16T12:00:00.000Z");
  });

  it("skips day where duration not in allowed_ms", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      duration: { allowed_ms: [30 * MINUTE, 90 * MINUTE] },
    });
    expect(generateSlots([day], [], HOUR, PAST, "UTC", false, Q.start, Q.end)).toHaveLength(0);
  });

  it("skips day where duration below min_ms", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], { duration: { min_ms: 2 * HOUR } });
    expect(generateSlots([day], [], HOUR, PAST, "UTC", false, Q.start, Q.end)).toHaveLength(0);
  });

  it("skips day where duration above max_ms", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      duration: { max_ms: 30 * MINUTE },
    });
    expect(generateSlots([day], [], HOUR, PAST, "UTC", false, Q.start, Q.end)).toHaveLength(0);
  });

  it("filters slots conflicting with allocations", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 13 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T10:00:00Z"),
        endTime: new Date("2026-03-16T11:00:00Z"),
      },
    ];
    const slots = generateSlots([day], allocs, HOUR, PAST, "UTC", false, Q.start, Q.end);
    const starts = slots.map((s) => s.startTime);

    expect(starts).toContain("2026-03-16T09:00:00.000Z");
    expect(starts).not.toContain("2026-03-16T10:00:00.000Z");
    expect(starts).toContain("2026-03-16T11:00:00.000Z");
    expect(starts).toContain("2026-03-16T12:00:00.000Z");
  });

  it("buffer-expanded conflict: after_ms extends conflict window", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 13 * HOUR]], {
      buffers: { after_ms: 10 * MINUTE },
    });
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T10:00:00Z"),
        endTime: new Date("2026-03-16T11:00:00Z"),
      },
    ];
    const slots = generateSlots([day], allocs, HOUR, PAST, "UTC", false, Q.start, Q.end);
    const starts = slots.map((s) => s.startTime);

    // Slot at 09:00: effective [09:00, 10:10) overlaps [10:00, 11:00) → excluded
    expect(starts).not.toContain("2026-03-16T09:00:00.000Z");
    // Slot at 11:00: effective [11:00, 12:10) does NOT overlap → included
    expect(starts).toContain("2026-03-16T11:00:00.000Z");
  });

  it("buffer-expanded conflict: before_ms extends conflict window", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 13 * HOUR]], {
      buffers: { before_ms: 15 * MINUTE },
    });
    // Small allocation at 09:50-10:00
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T09:50:00Z"),
        endTime: new Date("2026-03-16T10:00:00Z"),
      },
    ];
    const slots = generateSlots([day], allocs, HOUR, PAST, "UTC", false, Q.start, Q.end);
    const starts = slots.map((s) => s.startTime);

    // Slot at 10:00: effective start = 10:00 - 15min = 09:45. Overlaps [09:50, 10:00) → excluded
    expect(starts).not.toContain("2026-03-16T10:00:00.000Z");
    // Slot at 11:00: effective start = 10:45. 10:45 < 10:00? No → included
    expect(starts).toContain("2026-03-16T11:00:00.000Z");
  });

  it("lead time filtering excludes too-close slots", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 12 * HOUR]], {
      lead_time: { min_ms: 2 * HOUR },
    });
    const serverTime = new Date("2026-03-16T09:30:00Z");
    const slots = generateSlots([day], [], HOUR, serverTime, "UTC", false, Q.start, Q.end);

    // All slots (09:00, 10:00, 11:00) have < 2h lead time from 09:30
    expect(slots).toHaveLength(0);
  });

  it("horizon filtering excludes too-far slots", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 13 * HOUR]], {
      lead_time: { max_ms: 2 * HOUR },
    });
    const serverTime = new Date("2026-03-16T09:00:00Z");
    const slots = generateSlots([day], [], HOUR, serverTime, "UTC", false, Q.start, Q.end);
    const starts = slots.map((s) => s.startTime);

    expect(starts).toContain("2026-03-16T09:00:00.000Z"); // 0h ≤ 2h
    expect(starts).toContain("2026-03-16T10:00:00.000Z"); // 1h ≤ 2h
    expect(starts).toContain("2026-03-16T11:00:00.000Z"); // 2h ≤ 2h
    expect(starts).not.toContain("2026-03-16T12:00:00.000Z"); // 3h > 2h
  });

  it("includeUnavailable: all slots get status field", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 12 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T10:00:00Z"),
        endTime: new Date("2026-03-16T11:00:00Z"),
      },
    ];
    const slots = generateSlots([day], allocs, HOUR, PAST, "UTC", true, Q.start, Q.end);

    expect(slots).toHaveLength(3);
    expect(slots[0]!.status).toBe("available"); // 09:00
    expect(slots[1]!.status).toBe("unavailable"); // 10:00
    expect(slots[2]!.status).toBe("available"); // 11:00
  });

  it("includeUnavailable false: no status field, only available", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 12 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T10:00:00Z"),
        endTime: new Date("2026-03-16T11:00:00Z"),
      },
    ];
    const slots = generateSlots([day], allocs, HOUR, PAST, "UTC", false, Q.start, Q.end);

    expect(slots).toHaveLength(2);
    expect(slots[0]).not.toHaveProperty("status");
    expect(slots[1]).not.toHaveProperty("status");
  });

  it("query range clamping excludes out-of-range candidates", () => {
    const day = makeDay("2026-03-16", [[0, DAY]]); // 24h schedule
    const qStart = new Date("2026-03-16T10:00:00Z");
    const qEnd = new Date("2026-03-16T12:00:00Z");
    const slots = generateSlots([day], [], HOUR, PAST, "UTC", false, qStart, qEnd);

    // Only 10:00-11:00 and 11:00-12:00 fit
    expect(slots).toHaveLength(2);
    expect(slots[0]!.startTime).toBe("2026-03-16T10:00:00.000Z");
    expect(slots[1]!.startTime).toBe("2026-03-16T11:00:00.000Z");
  });

  it("multiple days: generates slots across days", () => {
    const days = [
      makeDay("2026-03-16", [[9 * HOUR, 11 * HOUR]]),
      makeDay("2026-03-17", [[9 * HOUR, 11 * HOUR]]),
    ];
    const qEnd = new Date("2026-03-18T00:00:00Z");
    const slots = generateSlots(days, [], HOUR, PAST, "UTC", false, Q.start, qEnd);

    expect(slots).toHaveLength(4);
    expect(slots[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(slots[2]!.startTime).toBe("2026-03-17T09:00:00.000Z");
  });

  it("per-day config variation: different grids per day", () => {
    const days = [
      makeDay("2026-03-16", [[9 * HOUR, 11 * HOUR]], { grid: { interval_ms: 30 * MINUTE } }),
      makeDay("2026-03-17", [[9 * HOUR, 11 * HOUR]], { grid: { interval_ms: HOUR } }),
    ];
    const qEnd = new Date("2026-03-18T00:00:00Z");
    const slots = generateSlots(days, [], HOUR, PAST, "UTC", false, Q.start, qEnd);

    const day1 = slots.filter((s) => s.startTime.startsWith("2026-03-16"));
    const day2 = slots.filter((s) => s.startTime.startsWith("2026-03-17"));

    // Day 1: 30min grid, 60min duration → 09:00, 09:30, 10:00 = 3 slots
    expect(day1).toHaveLength(3);
    // Day 2: 60min grid, 60min duration → 09:00, 10:00 = 2 slots
    expect(day2).toHaveLength(2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. computeWindows
// ═════════════════════════════════════════════════════════════════════════════

describe("computeWindows", () => {
  const Q = { start: new Date("2026-03-16T00:00:00Z"), end: new Date("2026-03-17T00:00:00Z") };

  it("full schedule, no allocations → single window", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const windows = computeWindows([day], [], PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });

  it("allocation subtraction carves out time", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T12:00:00Z"),
        endTime: new Date("2026-03-16T13:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(2);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T12:00:00.000Z");
    expect(windows[1]!.startTime).toBe("2026-03-16T13:00:00.000Z");
    expect(windows[1]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });

  it("asymmetric buffer shrinkage at allocation boundaries", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      buffers: { before_ms: 15 * MINUTE, after_ms: 10 * MINUTE },
    });
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T09:45:00Z"),
        endTime: new Date("2026-03-16T11:10:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    // Gap before: [09:00, 09:45) → end adjacent to alloc → shrink by after_ms(10min) → [09:00, 09:35)
    // Gap after: [11:10, 17:00) → start adjacent to alloc → shrink by before_ms(15min) → [11:25, 17:00)
    expect(windows).toHaveLength(2);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T09:35:00.000Z");
    expect(windows[1]!.startTime).toBe("2026-03-16T11:25:00.000Z");
    expect(windows[1]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });

  it("schedule boundaries do not shrink", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      buffers: { before_ms: HOUR, after_ms: HOUR },
    });
    const windows = computeWindows([day], [], PAST, "UTC", false, Q.start, Q.end);

    // No allocations → no adjacent allocations → no shrinkage
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });

  it("gap between two allocations shrinks from both sides", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      buffers: { before_ms: 15 * MINUTE, after_ms: 10 * MINUTE },
    });
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T09:00:00Z"),
        endTime: new Date("2026-03-16T11:00:00Z"),
      },
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T14:00:00Z"),
        endTime: new Date("2026-03-16T17:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    // Gap [11:00, 14:00):
    //   start adjacent to alloc1 end → +before_ms(15min) → 11:15
    //   end adjacent to alloc2 start → -after_ms(10min) → 13:50
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T11:15:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T13:50:00.000Z");
  });

  it("buffer shrinkage eliminates gap entirely", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], {
      buffers: { before_ms: 30 * MINUTE, after_ms: 30 * MINUTE },
    });
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T09:00:00Z"),
        endTime: new Date("2026-03-16T12:00:00Z"),
      },
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T12:30:00Z"),
        endTime: new Date("2026-03-16T17:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    // Gap [12:00, 12:30) → shrunk by 30min from each side → eliminated
    expect(windows).toHaveLength(0);
  });

  it("sub-minimum filtering discards short windows", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]], { duration: { min_ms: 2 * HOUR } });
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T09:00:00Z"),
        endTime: new Date("2026-03-16T12:00:00Z"),
      },
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T13:00:00Z"),
        endTime: new Date("2026-03-16T17:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    // Gap: 12:00-13:00 = 1h < min_ms 2h → discarded
    expect(windows).toHaveLength(0);
  });

  it("contiguous merging across day boundaries", () => {
    const days = [makeDay("2026-03-16", [[0, DAY]]), makeDay("2026-03-17", [[0, DAY]])];
    const qEnd = new Date("2026-03-18T00:00:00Z");
    const windows = computeWindows(days, [], PAST, "UTC", false, Q.start, qEnd);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T00:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-18T00:00:00.000Z");
  });

  it("includeUnavailable: returns both available and unavailable", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T12:00:00Z"),
        endTime: new Date("2026-03-16T13:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", true, Q.start, Q.end);

    const available = windows.filter((w) => w.status === "available");
    const unavailable = windows.filter((w) => w.status === "unavailable");

    expect(available).toHaveLength(2);
    expect(unavailable).toHaveLength(1);
    expect(unavailable[0]!.startTime).toBe("2026-03-16T12:00:00.000Z");
    expect(unavailable[0]!.endTime).toBe("2026-03-16T13:00:00.000Z");

    for (const w of windows) {
      expect(w.status).toMatch(/^(available|unavailable)$/);
    }
  });

  it("includeUnavailable false: no status field", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const windows = computeWindows([day], [], PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(1);
    expect(windows[0]).not.toHaveProperty("status");
  });

  it("query range clamping clips schedule windows", () => {
    const day = makeDay("2026-03-16", [[0, DAY]]);
    const qStart = new Date("2026-03-16T10:00:00Z");
    const qEnd = new Date("2026-03-16T14:00:00Z");
    const windows = computeWindows([day], [], PAST, "UTC", false, qStart, qEnd);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T10:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T14:00:00.000Z");
  });

  it("multiple schedule windows on same day", () => {
    const day = makeDay("2026-03-16", [
      [9 * HOUR, 12 * HOUR],
      [14 * HOUR, 18 * HOUR],
    ]);
    const windows = computeWindows([day], [], PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(2);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T12:00:00.000Z");
    expect(windows[1]!.startTime).toBe("2026-03-16T14:00:00.000Z");
    expect(windows[1]!.endTime).toBe("2026-03-16T18:00:00.000Z");
  });

  it("allocation fully outside schedule has no effect", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T07:00:00Z"),
        endTime: new Date("2026-03-16T08:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T09:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });

  it("allocation partially overlapping schedule start", () => {
    const day = makeDay("2026-03-16", [[9 * HOUR, 17 * HOUR]]);
    const allocs: BlockingAllocation[] = [
      {
        resourceId: "r",
        startTime: new Date("2026-03-16T08:00:00Z"),
        endTime: new Date("2026-03-16T10:00:00Z"),
      },
    ];
    const windows = computeWindows([day], allocs, PAST, "UTC", false, Q.start, Q.end);

    expect(windows).toHaveLength(1);
    expect(windows[0]!.startTime).toBe("2026-03-16T10:00:00.000Z");
    expect(windows[0]!.endTime).toBe("2026-03-16T17:00:00.000Z");
  });
});
