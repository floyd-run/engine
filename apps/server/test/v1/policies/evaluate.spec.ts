import { describe, expect, it } from "vitest";
import {
  evaluatePolicy,
  toLocalDate,
  msSinceLocalMidnight,
  getDayOfWeek,
  dateRange,
  REASON_CODES,
  type PolicyConfig,
  type EvaluationInput,
  type EvaluationContext,
  type EvaluationResult,
} from "services/policy/evaluate";

// ─── Constants ─────────────────────────────────────────────────────────────────

const HOUR = 3_600_000;
const MINUTE = 60_000;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Shorthand to build a minimal policy. */
function makePolicy(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    schema_version: 1,
    default: "open",
    config: {},
    ...overrides,
  };
}

/** Shorthand for a booking request. */
function makeRequest(startISO: string, endISO: string): EvaluationInput {
  return {
    startAt: new Date(startISO),
    endAt: new Date(endISO),
  };
}

/** Shorthand for evaluation context. */
function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    decisionTime: new Date("2026-03-16T08:00:00Z"),
    timezone: "UTC",
    ...overrides,
  };
}

/** Assert a result is denied with a specific code. */
function expectDenied(
  result: EvaluationResult,
  code: string,
): asserts result is Extract<EvaluationResult, { allowed: false }> {
  expect(result.allowed).toBe(false);
  if (!result.allowed) {
    expect(result.code).toBe(code);
  }
}

/** Assert a result is allowed. */
function expectAllowed(
  result: EvaluationResult,
): asserts result is Extract<EvaluationResult, { allowed: true }> {
  expect(result.allowed).toBe(true);
}

// =============================================================================
// 1. Timezone Helpers
// =============================================================================

describe("Timezone helpers", () => {
  describe("toLocalDate", () => {
    it("returns YYYY-MM-DD in UTC", () => {
      const d = new Date("2026-03-16T09:00:00Z");
      expect(toLocalDate(d, "UTC")).toBe("2026-03-16");
    });

    it("shifts date according to timezone offset", () => {
      // 2026-03-16T03:00:00Z in New York (EST, UTC-5) is still Mar 15 at 22:00
      const d = new Date("2026-03-16T03:00:00Z");
      expect(toLocalDate(d, "America/New_York")).toBe("2026-03-15");
    });

    it("handles exactly midnight UTC", () => {
      const d = new Date("2026-03-16T00:00:00Z");
      expect(toLocalDate(d, "UTC")).toBe("2026-03-16");
    });

    it("handles DST transition (US spring forward)", () => {
      // 2026-03-08 is spring-forward day in US. At 07:00 UTC, it's 03:00 EDT.
      const d = new Date("2026-03-08T07:00:00Z");
      expect(toLocalDate(d, "America/New_York")).toBe("2026-03-08");
    });

    it("handles year boundary", () => {
      const d = new Date("2026-01-01T04:00:00Z");
      expect(toLocalDate(d, "America/New_York")).toBe("2025-12-31");
    });
  });

  describe("msSinceLocalMidnight", () => {
    it("returns 0 for midnight UTC", () => {
      const d = new Date("2026-03-16T00:00:00Z");
      expect(msSinceLocalMidnight(d, "UTC")).toBe(0);
    });

    it("computes correctly for 09:30 UTC", () => {
      const d = new Date("2026-03-16T09:30:00Z");
      expect(msSinceLocalMidnight(d, "UTC")).toBe(9 * HOUR + 30 * MINUTE);
    });

    it("accounts for timezone offset", () => {
      // 2026-03-16T14:00:00Z in New York (EDT, UTC-4) is 10:00 local
      // Note: March 16, 2026 is after spring forward (Mar 8), so EDT (UTC-4)
      const d = new Date("2026-03-16T14:00:00Z");
      expect(msSinceLocalMidnight(d, "America/New_York")).toBe(10 * HOUR);
    });

    it("handles end of day (23:59:59)", () => {
      const d = new Date("2026-03-16T23:59:59Z");
      expect(msSinceLocalMidnight(d, "UTC")).toBe(23 * HOUR + 59 * MINUTE + 59 * 1000);
    });
  });

  describe("getDayOfWeek", () => {
    it("returns monday for 2026-03-16 (a Monday)", () => {
      expect(getDayOfWeek("2026-03-16")).toBe("monday");
    });

    it("returns sunday for 2026-03-15 (a Sunday)", () => {
      expect(getDayOfWeek("2026-03-15")).toBe("sunday");
    });

    it("returns friday for 2026-03-20", () => {
      expect(getDayOfWeek("2026-03-20")).toBe("friday");
    });

    it("returns saturday for 2026-03-21", () => {
      expect(getDayOfWeek("2026-03-21")).toBe("saturday");
    });

    it("returns wednesday for 2025-12-25 (Christmas)", () => {
      expect(getDayOfWeek("2025-12-25")).toBe("thursday");
    });
  });

  describe("dateRange", () => {
    it("returns single date when from === to", () => {
      expect(dateRange("2026-03-16", "2026-03-16")).toEqual(["2026-03-16"]);
    });

    it("returns inclusive range", () => {
      expect(dateRange("2026-03-16", "2026-03-18")).toEqual([
        "2026-03-16",
        "2026-03-17",
        "2026-03-18",
      ]);
    });

    it("handles month boundary", () => {
      expect(dateRange("2026-03-30", "2026-04-02")).toEqual([
        "2026-03-30",
        "2026-03-31",
        "2026-04-01",
        "2026-04-02",
      ]);
    });

    it("handles year boundary", () => {
      expect(dateRange("2025-12-31", "2026-01-02")).toEqual([
        "2025-12-31",
        "2026-01-01",
        "2026-01-02",
      ]);
    });

    it("returns empty array when from > to", () => {
      expect(dateRange("2026-03-18", "2026-03-16")).toEqual([]);
    });
  });
});

// =============================================================================
// 2. Step 1: Blackout Pre-Pass
// =============================================================================

describe("Step 1: Blackout pre-pass", () => {
  it("rejects single-day booking on a closed date", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "date", date: "2026-12-25" },
          closed: true,
        },
      ],
    });
    const request = makeRequest("2026-12-25T10:00:00Z", "2026-12-25T11:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-12-20T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
    expect(result.message).toContain("2026-12-25");
  });

  it("rejects multi-day booking overlapping a closed date (Dec 24-26 hitting Dec 25)", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "date", date: "2026-12-25" },
          closed: true,
        },
      ],
    });
    // Booking spans Dec 24 at 14:00 through Dec 26 at 10:00
    const request = makeRequest("2026-12-24T14:00:00Z", "2026-12-26T10:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-12-20T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
    expect(result.message).toContain("2026-12-25");
  });

  it("allows booking ending exactly at midnight (half-open: end exclusive)", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "date", date: "2026-12-25" },
          closed: true,
        },
      ],
    });
    // Booking on Dec 24 ending exactly at midnight (start of Dec 25)
    // Half-open means the end instant is exclusive, so Dec 25 is NOT overlapped
    const request = makeRequest("2026-12-24T22:00:00Z", "2026-12-25T00:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-12-20T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("rejects when any date in a date_range is closed", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "date_range", from: "2026-12-24", to: "2026-12-26" },
          closed: true,
        },
      ],
    });
    const request = makeRequest("2026-12-24T10:00:00Z", "2026-12-24T11:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-12-20T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
  });

  it("rejects when a weekly closed rule matches any overlapped date", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "weekly", days: ["sunday"] },
          closed: true,
        },
      ],
    });
    // 2026-03-15 is a Sunday
    const request = makeRequest("2026-03-14T20:00:00Z", "2026-03-15T10:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-10T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
  });

  it("does not reject when closed date is not overlapped", () => {
    const policy = makePolicy({
      rules: [
        {
          match: { type: "date", date: "2026-12-25" },
          closed: true,
        },
      ],
    });
    const request = makeRequest("2026-12-26T10:00:00Z", "2026-12-26T11:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-12-20T00:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });
});

// =============================================================================
// 3. Steps 2-3: Rule Resolution + Open/Closed
// =============================================================================

describe("Steps 2-3: Rule resolution + open/closed", () => {
  it("first-match-wins: earlier weekly rule takes precedence", () => {
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
    // Monday booking at 13:00-14:00 -- first rule only goes to 12:00
    const request = makeRequest("2026-03-16T13:00:00Z", "2026-03-16T14:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("default 'open' with no rules allows all times", () => {
    const policy = makePolicy({ default: "open" });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("default 'closed' with no rules rejects", () => {
    const policy = makePolicy({ default: "closed" });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
    expect(result.message).toContain("default is closed");
  });

  it("windowed rule allows booking inside window", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("windowed rule rejects booking outside window", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Booking at 07:00-08:00, before the 09:00-17:00 window
    const request = makeRequest("2026-03-16T07:00:00Z", "2026-03-16T08:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("windowed rule rejects booking that starts inside but ends outside window", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Booking at 16:00-18:00, starts inside but ends outside
    const request = makeRequest("2026-03-16T16:00:00Z", "2026-03-16T18:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("no windows on matched rule means open 24h", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          // No windows property at all
        },
      ],
    });
    // Booking at 23:00-23:30 on Monday -- should be allowed since no windows = 24h open
    const request = makeRequest("2026-03-16T23:00:00Z", "2026-03-16T23:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("matched rule with empty windows array means open 24h", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [],
        },
      ],
    });
    const request = makeRequest("2026-03-16T14:00:00Z", "2026-03-16T15:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("midnight normalization: Mon 22:00-Tue 00:00 treated as same-day ending at 24:00", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "24:00" }],
        },
      ],
    });
    // Monday 22:00 to Tuesday 00:00 (exactly midnight)
    const request = makeRequest("2026-03-16T22:00:00Z", "2026-03-17T00:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("overnight rejection: booking spans midnight with windowed rule", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "23:00" }],
        },
      ],
    });
    // Monday 22:00 to Tuesday 01:00 -- spans midnight, end is NOT exactly midnight
    const request = makeRequest("2026-03-16T22:00:00Z", "2026-03-17T01:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.OVERNIGHT_NOT_SUPPORTED);
  });

  it("booking within one of multiple windows is allowed", () => {
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
    // Booking at 14:00-15:00, fits in second window
    const request = makeRequest("2026-03-16T14:00:00Z", "2026-03-16T15:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("booking that falls between two windows is rejected", () => {
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
    // Booking at 12:30-13:30, between windows
    const request = makeRequest("2026-03-16T12:30:00Z", "2026-03-16T13:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("date rule matches by exact date", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "date", date: "2026-03-16" },
          windows: [{ start: "10:00", end: "14:00" }],
        },
      ],
    });
    const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("date_range rule with day filter matches correctly", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: {
            type: "date_range",
            from: "2026-03-01",
            to: "2026-03-31",
            days: ["monday", "wednesday", "friday"],
          },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // March 16 is Monday, should match
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("date_range rule with day filter does not match excluded day", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: {
            type: "date_range",
            from: "2026-03-01",
            to: "2026-03-31",
            days: ["monday", "wednesday", "friday"],
          },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // March 17 is Tuesday, not in days list, should fall to default closed
    const request = makeRequest("2026-03-17T09:00:00Z", "2026-03-17T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });
});

// =============================================================================
// 4. Step 4: Config Merge
// =============================================================================

describe("Step 4: Config merge", () => {
  it("rule config overrides base config (section-level replace)", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
        grid: { interval_ms: 30 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          config: {
            duration: { min_ms: 60 * MINUTE, max_ms: 60 * MINUTE },
          },
        },
      ],
    });
    // 1 hour booking on Monday
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    // Duration should come from rule config, grid should come from base config
    expect(result.resolvedConfig.duration).toEqual({
      min_ms: 60 * MINUTE,
      max_ms: 60 * MINUTE,
    });
    expect(result.resolvedConfig.grid).toEqual({ interval_ms: 30 * MINUTE });
  });

  it("base config preserved when rule has no config", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
        buffers: { before_ms: 5 * MINUTE, after_ms: 5 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          // No config override
        },
      ],
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.resolvedConfig.duration).toEqual({
      min_ms: 30 * MINUTE,
      max_ms: 120 * MINUTE,
    });
    expect(result.resolvedConfig.buffers).toEqual({
      before_ms: 5 * MINUTE,
      after_ms: 5 * MINUTE,
    });
  });

  it("rule config fully replaces a section (not deep merge)", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          config: {
            // Override duration with only allowed_ms -- min_ms/max_ms from base should NOT survive
            duration: { allowed_ms: [60 * MINUTE] },
          },
        },
      ],
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    // The entire duration section is replaced by rule config
    expect(result.resolvedConfig.duration).toEqual({
      allowed_ms: [60 * MINUTE],
    });
  });
});

// =============================================================================
// 5. Step 5: Duration
// =============================================================================

describe("Step 5: Duration", () => {
  it("allowed_ms takes precedence over min/max -- duration in list is allowed", () => {
    const policy = makePolicy({
      config: {
        duration: {
          min_ms: 30 * MINUTE,
          max_ms: 120 * MINUTE,
          allowed_ms: [30 * MINUTE, 60 * MINUTE],
        },
      },
    });
    // 30 min booking is in allowed_ms
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("allowed_ms takes precedence -- duration NOT in list is rejected even if within min/max", () => {
    const policy = makePolicy({
      config: {
        duration: {
          min_ms: 30 * MINUTE,
          max_ms: 120 * MINUTE,
          allowed_ms: [30 * MINUTE, 60 * MINUTE],
        },
      },
    });
    // 45 min booking is within min/max but NOT in allowed_ms
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:45:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.INVALID_DURATION);
    expect(result.details?.allowed_ms).toEqual([30 * MINUTE, 60 * MINUTE]);
  });

  it("duration below min_ms is rejected", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 60 * MINUTE, max_ms: 120 * MINUTE },
      },
    });
    // 30 min booking, below 60 min minimum
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.INVALID_DURATION);
    expect(result.details?.min_ms).toBe(60 * MINUTE);
  });

  it("duration above max_ms is rejected", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 60 * MINUTE },
      },
    });
    // 90 min booking, above 60 min maximum
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.INVALID_DURATION);
    expect(result.details?.max_ms).toBe(60 * MINUTE);
  });

  it("duration within min/max is allowed", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
      },
    });
    // 60 min booking, within [30, 120]
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("duration exactly at min_ms boundary is allowed", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
      },
    });
    // Exactly 30 min
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("duration exactly at max_ms boundary is allowed", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 120 * MINUTE },
      },
    });
    // Exactly 120 min
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("no duration config means no duration enforcement", () => {
    const policy = makePolicy({
      config: {},
    });
    // Very long booking, no duration limits
    const request = makeRequest("2026-03-16T00:00:00Z", "2026-03-16T23:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });
});

// =============================================================================
// 6. Step 6: Grid Alignment
// =============================================================================

describe("Step 6: Grid alignment", () => {
  it("aligned start time is allowed (30-min grid)", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 30 * MINUTE },
      },
    });
    // 09:00 -> 9h * 60 * 60 * 1000 = 32400000, 32400000 % 1800000 = 0
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("aligned start time at 09:30 on 30-min grid is allowed", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 30 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:30:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("misaligned start time is rejected (30-min grid)", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 30 * MINUTE },
      },
    });
    // 09:15 -> 15 min past the grid line
    const request = makeRequest("2026-03-16T09:15:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
    expect(result.details?.interval_ms).toBe(30 * MINUTE);
    expect(result.details?.remainder).toBe(15 * MINUTE);
  });

  it("15-minute grid: start at :45 is aligned", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 15 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:45:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("1-hour grid: start at :30 is misaligned", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 60 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:30:00Z", "2026-03-16T10:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
  });

  it("no grid config means no alignment enforcement", () => {
    const policy = makePolicy({
      config: {},
    });
    const request = makeRequest("2026-03-16T09:17:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });
});

// =============================================================================
// 7. Steps 7-8: Lead Time + Horizon
// =============================================================================

describe("Steps 7-8: Lead time + horizon", () => {
  it("booking within lead time is rejected", () => {
    const policy = makePolicy({
      config: {
        booking_window: { min_lead_time_ms: 2 * HOUR },
      },
    });
    // Decision at 08:00, booking at 09:00, only 1h lead time, need 2h
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.LEAD_TIME_VIOLATION);
    expect(result.details?.leadTimeMs).toBe(1 * HOUR);
    expect(result.details?.min_lead_time_ms).toBe(2 * HOUR);
  });

  it("booking beyond horizon is rejected", () => {
    const policy = makePolicy({
      config: {
        booking_window: { max_lead_time_ms: 7 * 24 * HOUR },
      },
    });
    // Decision at 08:00 on Mar 16, booking at Mar 30 (14 days away), horizon is 7 days
    const request = makeRequest("2026-03-30T09:00:00Z", "2026-03-30T10:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.HORIZON_EXCEEDED);
  });

  it("booking within both lead time and horizon is allowed", () => {
    const policy = makePolicy({
      config: {
        booking_window: {
          min_lead_time_ms: 1 * HOUR,
          max_lead_time_ms: 30 * 24 * HOUR,
        },
      },
    });
    // Decision at 08:00, booking at 10:00 (2h lead time), within 30d horizon
    const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("booking exactly at min_lead_time boundary is allowed", () => {
    const policy = makePolicy({
      config: {
        booking_window: { min_lead_time_ms: 2 * HOUR },
      },
    });
    // Decision at 08:00, booking at 10:00, exactly 2h lead time
    const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("booking exactly at max_lead_time boundary is allowed", () => {
    const policy = makePolicy({
      config: {
        booking_window: { max_lead_time_ms: 7 * 24 * HOUR },
      },
    });
    // Decision at 08:00 on Mar 16, booking at exactly 7 days later
    const request = makeRequest("2026-03-23T08:00:00Z", "2026-03-23T09:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("no booking_window config means no lead time or horizon enforcement", () => {
    const policy = makePolicy({ config: {} });
    // Booking 1 minute in the future
    const request = makeRequest("2026-03-16T08:01:00Z", "2026-03-16T09:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("lead time check runs before horizon check (correct order)", () => {
    const policy = makePolicy({
      config: {
        booking_window: {
          min_lead_time_ms: 2 * HOUR,
          max_lead_time_ms: 7 * 24 * HOUR,
        },
      },
    });
    // Decision at 08:00, booking at 08:30 -- violates lead time (30 min < 2h)
    const request = makeRequest("2026-03-16T08:30:00Z", "2026-03-16T09:00:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.LEAD_TIME_VIOLATION);
  });
});

// =============================================================================
// 8. Step 9: Buffers
// =============================================================================

describe("Step 9: Buffers", () => {
  it("buffer before/after computed correctly", () => {
    const policy = makePolicy({
      config: {
        buffers: { before_ms: 10 * MINUTE, after_ms: 15 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(10 * MINUTE);
    expect(result.bufferAfterMs).toBe(15 * MINUTE);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T08:50:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:15:00.000Z");
  });

  it("no buffers means effective equals original", () => {
    const policy = makePolicy({ config: {} });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(0);
    expect(result.bufferAfterMs).toBe(0);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T09:00:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("only buffer_before_ms is set", () => {
    const policy = makePolicy({
      config: {
        buffers: { before_ms: 5 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(5 * MINUTE);
    expect(result.bufferAfterMs).toBe(0);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T08:55:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("only buffer_after_ms is set", () => {
    const policy = makePolicy({
      config: {
        buffers: { after_ms: 10 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(0);
    expect(result.bufferAfterMs).toBe(10 * MINUTE);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T09:00:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:10:00.000Z");
  });
});

// =============================================================================
// 9. Common Patterns (from spec section 8)
// =============================================================================

describe("Common patterns", () => {
  describe("Simple salon (Mon-Fri 9-5, 30/60 min)", () => {
    const salonPolicy: PolicyConfig = {
      schema_version: 1,
      default: "closed",
      config: {
        duration: { allowed_ms: [30 * MINUTE, 60 * MINUTE] },
        grid: { interval_ms: 30 * MINUTE },
        booking_window: {
          min_lead_time_ms: 1 * HOUR,
          max_lead_time_ms: 14 * 24 * HOUR,
        },
        buffers: { before_ms: 0, after_ms: 10 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    };

    it("allows 30-min appointment at 10:00 on Monday", () => {
      const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T10:30:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectAllowed(result);
      expect(result.bufferAfterMs).toBe(10 * MINUTE);
      expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:40:00.000Z");
    });

    it("allows 60-min appointment at 09:30 on Wednesday", () => {
      // 2026-03-18 is Wednesday
      const request = makeRequest("2026-03-18T09:30:00Z", "2026-03-18T10:30:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-18T08:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectAllowed(result);
    });

    it("rejects 45-min appointment (not in allowed_ms)", () => {
      const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T10:45:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectDenied(result, REASON_CODES.INVALID_DURATION);
    });

    it("rejects Saturday booking (closed by schedule)", () => {
      // 2026-03-21 is Saturday
      const request = makeRequest("2026-03-21T10:00:00Z", "2026-03-21T11:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-20T08:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
    });

    it("rejects booking at 08:00 (before 9-5 window)", () => {
      const request = makeRequest("2026-03-16T08:00:00Z", "2026-03-16T09:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T06:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
    });

    it("rejects misaligned booking at 10:15", () => {
      const request = makeRequest("2026-03-16T10:15:00Z", "2026-03-16T11:15:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(salonPolicy, request, context);
      expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
    });
  });

  describe("24/7 resource (default open, no rules)", () => {
    const openPolicy: PolicyConfig = {
      schema_version: 1,
      default: "open",
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 8 * HOUR },
      },
    };

    it("allows booking at any time of day", () => {
      const request = makeRequest("2026-03-16T03:00:00Z", "2026-03-16T04:00:00Z");
      const context = makeContext();

      const result = evaluatePolicy(openPolicy, request, context);
      expectAllowed(result);
    });

    it("allows weekend booking", () => {
      // 2026-03-21 is Saturday
      const request = makeRequest("2026-03-21T14:00:00Z", "2026-03-21T16:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-20T08:00:00Z") });

      const result = evaluatePolicy(openPolicy, request, context);
      expectAllowed(result);
    });

    it("still enforces duration limits", () => {
      // 10 hour booking, max is 8h
      const request = makeRequest("2026-03-16T08:00:00Z", "2026-03-16T18:00:00Z");
      const context = makeContext();

      const result = evaluatePolicy(openPolicy, request, context);
      expectDenied(result, REASON_CODES.INVALID_DURATION);
    });
  });

  describe("Holiday closure (closed date rule before weekly)", () => {
    const holidayPolicy: PolicyConfig = {
      schema_version: 1,
      default: "closed",
      config: {
        duration: { min_ms: 30 * MINUTE, max_ms: 2 * HOUR },
      },
      rules: [
        // Holiday closure BEFORE weekly rules so blackout fires first
        {
          match: { type: "date", date: "2026-12-25" },
          closed: true,
        },
        {
          match: { type: "weekly", days: ["monday", "tuesday", "wednesday", "thursday", "friday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    };

    it("allows normal weekday booking", () => {
      // 2026-12-23 is Wednesday
      const request = makeRequest("2026-12-23T10:00:00Z", "2026-12-23T11:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-12-20T08:00:00Z") });

      const result = evaluatePolicy(holidayPolicy, request, context);
      expectAllowed(result);
    });

    it("rejects Christmas day booking (blackout)", () => {
      // 2026-12-25 is Friday
      const request = makeRequest("2026-12-25T10:00:00Z", "2026-12-25T11:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-12-20T08:00:00Z") });

      const result = evaluatePolicy(holidayPolicy, request, context);
      expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
    });
  });

  describe("Multi-day rental (no windows, closed blackout)", () => {
    const rentalPolicy: PolicyConfig = {
      schema_version: 1,
      default: "open",
      config: {
        duration: { min_ms: 24 * HOUR, max_ms: 7 * 24 * HOUR },
        booking_window: { min_lead_time_ms: 24 * HOUR },
      },
      rules: [
        {
          match: { type: "date_range", from: "2026-12-24", to: "2026-12-26" },
          closed: true,
        },
      ],
    };

    it("allows a 3-day rental starting well before blackout", () => {
      const request = makeRequest("2026-12-10T12:00:00Z", "2026-12-13T12:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-12-05T08:00:00Z") });

      const result = evaluatePolicy(rentalPolicy, request, context);
      expectAllowed(result);
    });

    it("rejects rental spanning blackout period", () => {
      const request = makeRequest("2026-12-23T12:00:00Z", "2026-12-27T12:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-12-10T08:00:00Z") });

      const result = evaluatePolicy(rentalPolicy, request, context);
      expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
    });

    it("rejects rental too short (12 hours, min is 24 hours)", () => {
      const request = makeRequest("2026-12-10T12:00:00Z", "2026-12-11T00:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-12-05T08:00:00Z") });

      const result = evaluatePolicy(rentalPolicy, request, context);
      expectDenied(result, REASON_CODES.INVALID_DURATION);
    });
  });

  describe("Escape room (fixed duration, grid, buffer)", () => {
    const escapeRoomPolicy: PolicyConfig = {
      schema_version: 1,
      default: "closed",
      config: {
        duration: { allowed_ms: [60 * MINUTE] },
        grid: { interval_ms: 90 * MINUTE },
        buffers: { before_ms: 15 * MINUTE, after_ms: 15 * MINUTE },
        booking_window: {
          min_lead_time_ms: 2 * HOUR,
          max_lead_time_ms: 30 * 24 * HOUR,
        },
      },
      rules: [
        {
          match: {
            type: "weekly",
            days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          },
          windows: [{ start: "10:00", end: "22:00" }],
        },
      ],
    };

    it("allows properly aligned 60-min booking with buffers", () => {
      // 10:00 is aligned to 90-min grid (10h * 60 * 60 * 1000 = 36000000, 36000000 % 5400000 = 0? Let's check: 36000000/5400000 = 6.666... no)
      // Actually 0:00 is 0ms, 1:30 is 5400000, 3:00 is 10800000, etc.
      // 10:00 = 36000000ms. 36000000 % 5400000 = 36000000 - 6*5400000 = 36000000 - 32400000 = 3600000. Not 0.
      // Need start at a multiple of 90 min: 0:00, 1:30, 3:00, 4:30, 6:00, 7:30, 9:00, 10:30, 12:00, ...
      // 10:30 = 37800000ms. 37800000 % 5400000 = 37800000 - 7*5400000 = 37800000-37800000 = 0. Yes!
      const request = makeRequest("2026-03-16T10:30:00Z", "2026-03-16T11:30:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(escapeRoomPolicy, request, context);
      expectAllowed(result);

      expect(result.bufferBeforeMs).toBe(15 * MINUTE);
      expect(result.bufferAfterMs).toBe(15 * MINUTE);
      expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T10:15:00.000Z");
      expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T11:45:00.000Z");
    });

    it("rejects 90-min booking (only 60 min allowed)", () => {
      const request = makeRequest("2026-03-16T10:30:00Z", "2026-03-16T12:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(escapeRoomPolicy, request, context);
      expectDenied(result, REASON_CODES.INVALID_DURATION);
    });

    it("rejects misaligned start (not on 90-min grid)", () => {
      // 10:00 is not aligned to 90-min grid
      const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T08:00:00Z") });

      const result = evaluatePolicy(escapeRoomPolicy, request, context);
      expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
    });

    it("rejects booking too soon (within 2h lead time)", () => {
      // Decision at 10:00, booking at 10:30, only 30 min lead time
      const request = makeRequest("2026-03-16T10:30:00Z", "2026-03-16T11:30:00Z");
      const context = makeContext({ decisionTime: new Date("2026-03-16T10:00:00Z") });

      const result = evaluatePolicy(escapeRoomPolicy, request, context);
      expectDenied(result, REASON_CODES.LEAD_TIME_VIOLATION);
    });
  });
});

// =============================================================================
// 10. Admin Override (skipPolicy)
// =============================================================================

describe("Admin override (skipPolicy)", () => {
  it("skipPolicy: true bypasses all checks (Steps 1-8)", () => {
    const policy = makePolicy({
      default: "closed",
      config: {
        duration: { allowed_ms: [60 * MINUTE] },
        grid: { interval_ms: 30 * MINUTE },
        booking_window: { min_lead_time_ms: 24 * HOUR },
      },
      rules: [
        {
          match: { type: "date", date: "2026-03-16" },
          closed: true,
        },
      ],
    });

    // This booking violates everything: blackout, duration (45 min), grid (09:15), lead time
    const request = makeRequest("2026-03-16T09:15:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext({
      decisionTime: new Date("2026-03-16T09:00:00Z"),
      skipPolicy: true,
    });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("skipPolicy: true still computes buffers from base config", () => {
    const policy = makePolicy({
      config: {
        buffers: { before_ms: 10 * MINUTE, after_ms: 5 * MINUTE },
      },
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext({ skipPolicy: true });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(10 * MINUTE);
    expect(result.bufferAfterMs).toBe(5 * MINUTE);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T08:50:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:05:00.000Z");
  });

  it("skipPolicy: true with no buffers returns zero buffers", () => {
    const policy = makePolicy({ config: {} });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext({ skipPolicy: true });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(0);
    expect(result.bufferAfterMs).toBe(0);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T09:00:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("skipPolicy: false behaves normally (checks enforced)", () => {
    const policy = makePolicy({
      default: "closed",
      config: {},
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext({ skipPolicy: false });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });
});

// =============================================================================
// 11. Edge Cases
// =============================================================================

describe("Edge cases", () => {
  it("invalid schema_version returns policy_invalid_config", () => {
    const policy = makePolicy({ schema_version: 2 });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.POLICY_INVALID_CONFIG);
  });

  it("schema_version 0 returns policy_invalid_config", () => {
    const policy = makePolicy({ schema_version: 0 });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.POLICY_INVALID_CONFIG);
  });

  it("empty rules + default open allows all times", () => {
    const policy = makePolicy({ default: "open", rules: [] });
    const request = makeRequest("2026-03-16T03:00:00Z", "2026-03-16T04:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("undefined rules + default open allows all times", () => {
    const policy = makePolicy({ default: "open" });
    const request = makeRequest("2026-03-16T03:00:00Z", "2026-03-16T04:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("empty config means no enforcement beyond schedule", () => {
    const policy = makePolicy({
      default: "closed",
      config: {},
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Any duration, any start time within window, should be allowed
    const request = makeRequest("2026-03-16T09:17:00Z", "2026-03-16T16:59:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("midnight normalization does NOT apply when end is after midnight (not exactly midnight)", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "24:00" }],
        },
      ],
    });
    // Monday 22:00 to Tuesday 00:01 -- NOT exactly midnight, so spans multiple days
    const request = makeRequest("2026-03-16T22:00:00Z", "2026-03-17T00:01:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.OVERNIGHT_NOT_SUPPORTED);
  });

  it("booking that starts and ends at the exact same time with duration config is rejected", () => {
    const policy = makePolicy({
      config: {
        duration: { min_ms: 30 * MINUTE },
      },
    });
    // Zero-duration booking
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.INVALID_DURATION);
  });

  it("evaluation order: blackout checked before schedule windows", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "date", date: "2026-03-16" },
          closed: true,
        },
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Even though a weekly rule would match, blackout should fire first
    const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.BLACKOUT_WINDOW);
  });

  it("evaluation order: schedule checked before duration", () => {
    const policy = makePolicy({
      default: "closed",
      config: {
        duration: { allowed_ms: [60 * MINUTE] },
      },
    });
    // No rules match and default is closed -- should get closed_by_schedule, not invalid_duration
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:30:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("evaluation order: duration checked before grid", () => {
    const policy = makePolicy({
      config: {
        duration: { allowed_ms: [60 * MINUTE] },
        grid: { interval_ms: 30 * MINUTE },
      },
    });
    // 45-min duration (invalid) at 09:00 (aligned) -- should get invalid_duration
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T09:45:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.INVALID_DURATION);
  });

  it("evaluation order: grid checked before lead time", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 60 * MINUTE },
        booking_window: { min_lead_time_ms: 24 * HOUR },
      },
    });
    // Misaligned start (09:15) and too soon -- should get misaligned_start_time
    const request = makeRequest("2026-03-16T09:15:00Z", "2026-03-16T10:15:00Z");
    const context = makeContext({ decisionTime: new Date("2026-03-16T09:00:00Z") });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
  });

  it("rule config with buffers overrides base buffers", () => {
    const policy = makePolicy({
      config: {
        buffers: { before_ms: 10 * MINUTE, after_ms: 10 * MINUTE },
      },
      rules: [
        {
          match: { type: "weekly", days: ["monday"] },
          config: {
            buffers: { before_ms: 30 * MINUTE, after_ms: 0 },
          },
        },
      ],
    });
    const request = makeRequest("2026-03-16T09:00:00Z", "2026-03-16T10:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);

    expect(result.bufferBeforeMs).toBe(30 * MINUTE);
    expect(result.bufferAfterMs).toBe(0);
    expect(result.effectiveStartAt.toISOString()).toBe("2026-03-16T08:30:00.000Z");
    expect(result.effectiveEndAt.toISOString()).toBe("2026-03-16T10:00:00.000Z");
  });

  it("closed rule is skipped in Step 2 (rule resolution)", () => {
    const policy = makePolicy({
      default: "closed",
      rules: [
        // First rule matches Monday but is closed -- blackout handles it
        // This tests that a closed rule doesn't "consume" the match for Step 2
        {
          match: { type: "date", date: "2026-03-17" },
          closed: true,
        },
        {
          match: { type: "weekly", days: ["monday"] },
          windows: [{ start: "09:00", end: "17:00" }],
        },
      ],
    });
    // Monday 2026-03-16 -- the date closed rule is for Mar 17, so it doesn't fire
    // The weekly rule for Monday should match
    const request = makeRequest("2026-03-16T10:00:00Z", "2026-03-16T11:00:00Z");
    const context = makeContext();

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });

  it("timezone-aware date resolution: same UTC instant resolves to different dates", () => {
    // 2026-03-16T04:00:00Z is:
    //   - March 16 in UTC
    //   - March 15 in America/New_York (EST = UTC-5 on this date... wait, Mar 8 is spring forward)
    //   - March 16 00:00 EDT = March 16 04:00 UTC. So 04:00 UTC = 00:00 EDT Mar 16.
    //   - Actually EDT is UTC-4. So 04:00 UTC = 00:00 EDT.
    //   - That's midnight on March 16 in EDT.

    // Let's use a clearer example: 2026-03-16T03:00:00Z
    // In EDT (UTC-4): 2026-03-15 23:00 EDT
    const policy = makePolicy({
      default: "closed",
      rules: [
        {
          match: { type: "weekly", days: ["sunday"] },
          windows: [{ start: "22:00", end: "24:00" }],
        },
      ],
    });

    // In UTC: Mar 16 Monday 03:00
    // In New York (EDT, UTC-4): Mar 15 Sunday 23:00
    const request = makeRequest("2026-03-16T03:00:00Z", "2026-03-16T04:00:00Z");
    const contextNY = makeContext({ timezone: "America/New_York" });

    const resultNY = evaluatePolicy(policy, request, contextNY);
    // In New York it's Sunday 23:00-00:00, should fit the Sunday 22:00-24:00 window
    expectAllowed(resultNY);

    // Same instant in UTC: it's Monday, no rule matches, default closed
    const contextUTC = makeContext({ timezone: "UTC" });
    const resultUTC = evaluatePolicy(policy, request, contextUTC);
    expectDenied(resultUTC, REASON_CODES.CLOSED_BY_SCHEDULE);
  });

  it("grid alignment is timezone-aware", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 60 * MINUTE },
      },
    });

    // 2026-03-16T14:30:00Z in EDT (UTC-4) = 10:30 local
    // 10:30 local means ms_since_midnight = 10.5 hours = 37800000
    // 37800000 % 3600000 = 1800000 (not 0, misaligned)
    const request = makeRequest("2026-03-16T14:30:00Z", "2026-03-16T15:30:00Z");
    const context = makeContext({ timezone: "America/New_York" });

    const result = evaluatePolicy(policy, request, context);
    expectDenied(result, REASON_CODES.MISALIGNED_START_TIME);
  });

  it("grid alignment passes when local time is aligned but UTC is not", () => {
    const policy = makePolicy({
      config: {
        grid: { interval_ms: 60 * MINUTE },
      },
    });

    // 2026-03-16T14:00:00Z in EDT (UTC-4) = 10:00 local
    // 10:00 local = 36000000ms. 36000000 % 3600000 = 0 (aligned)
    const request = makeRequest("2026-03-16T14:00:00Z", "2026-03-16T15:00:00Z");
    const context = makeContext({ timezone: "America/New_York" });

    const result = evaluatePolicy(policy, request, context);
    expectAllowed(result);
  });
});
