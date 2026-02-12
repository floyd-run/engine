/**
 * Pure policy evaluator.
 *
 * Takes a canonical policy config, a booking request, and evaluation context.
 * Returns whether the booking is allowed and the resolved config + effective windows.
 *
 * Conflict detection is NOT here — it stays in the allocation service.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export const REASON_CODES = {
  BLACKOUT_WINDOW: "blackout_window",
  CLOSED_BY_SCHEDULE: "closed_by_schedule",
  OVERNIGHT_NOT_SUPPORTED: "overnight_not_supported",
  INVALID_DURATION: "invalid_duration",
  MISALIGNED_START_TIME: "misaligned_start_time",
  LEAD_TIME_VIOLATION: "lead_time_violation",
  HORIZON_EXCEEDED: "horizon_exceeded",
  POLICY_INVALID_CONFIG: "policy_invalid_config",
  POLICY_EVAL_ERROR: "policy_eval_error",
} as const;

export type ReasonCode = (typeof REASON_CODES)[keyof typeof REASON_CODES];

export interface EvaluationInput {
  startAt: Date;
  endAt: Date;
}

export interface EvaluationContext {
  decisionTime: Date;
  timezone: string;
  skipPolicy?: boolean;
}

interface DurationConfig {
  min_ms?: number;
  max_ms?: number;
  allowed_ms?: number[];
}

interface GridConfig {
  interval_ms: number;
}

interface BookingWindowConfig {
  min_lead_time_ms?: number;
  max_lead_time_ms?: number;
}

interface BuffersConfig {
  before_ms?: number;
  after_ms?: number;
}

export interface ResolvedConfig {
  duration?: DurationConfig | undefined;
  grid?: GridConfig | undefined;
  booking_window?: BookingWindowConfig | undefined;
  buffers?: BuffersConfig | undefined;
}

interface TimeWindow {
  start: string;
  end: string;
}

interface RuleMatch {
  type: "weekly" | "date" | "date_range";
  days?: string[];
  date?: string;
  from?: string;
  to?: string;
}

interface Rule {
  match: RuleMatch;
  closed?: true;
  windows?: TimeWindow[];
  config?: Record<string, unknown>;
}

export interface PolicyConfig {
  schema_version: number;
  default: "open" | "closed";
  config: Record<string, unknown>;
  rules?: Rule[];
  metadata?: Record<string, unknown>;
}

export type EvaluationResult =
  | {
      allowed: true;
      resolvedConfig: ResolvedConfig;
      effectiveStartAt: Date;
      effectiveEndAt: Date;
      bufferBeforeMs: number;
      bufferAfterMs: number;
    }
  | {
      allowed: false;
      code: ReasonCode;
      message: string;
      details?: Record<string, unknown>;
    };

// ─── Timezone Helpers ────────────────────────────────────────────────────────

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Get the local date string (YYYY-MM-DD) for an instant in a timezone.
 */
export function toLocalDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return `${year}-${month}-${day}`;
}

/**
 * Get milliseconds since local midnight for an instant in a timezone.
 */
export function msSinceLocalMidnight(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
    hour12: false,
  }).formatToParts(instant);

  const hour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const second = parseInt(parts.find((p) => p.type === "second")!.value);
  const fraction = parts.find((p) => p.type === "fractionalSecond");
  const ms = fraction ? parseInt(fraction.value) : 0;

  return hour * 3_600_000 + minute * 60_000 + second * 1_000 + ms;
}

/**
 * Get the day of week for a date string (YYYY-MM-DD).
 */
export function getDayOfWeek(
  dateStr: string,
): "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday" {
  // Parse as UTC to avoid timezone issues with the date itself
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year!, month! - 1, day!));
  return DAY_NAMES[d.getUTCDay()]! as ReturnType<typeof getDayOfWeek>;
}

/**
 * Generate an inclusive date range (YYYY-MM-DD strings).
 */
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const current = new Date(Date.UTC(fy!, fm! - 1, fd!));
  const end = new Date(Date.UTC(ty!, tm! - 1, td!));

  while (current <= end) {
    dates.push(
      `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}-${String(current.getUTCDate()).padStart(2, "0")}`,
    );
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Convert time string (HH:MM) to milliseconds since midnight.
 */
function timeToMs(time: string): number {
  if (time === "24:00") return 1440 * 60_000;
  const [h, m] = time.split(":").map(Number);
  return h! * 3_600_000 + m! * 60_000;
}

// ─── Match Logic ─────────────────────────────────────────────────────────────

function matchesCondition(match: RuleMatch, dateStr: string, dayOfWeek: string): boolean {
  switch (match.type) {
    case "weekly":
      return match.days?.includes(dayOfWeek) ?? false;

    case "date":
      return dateStr === match.date;

    case "date_range": {
      if (dateStr < match.from! || dateStr > match.to!) return false;
      if (match.days && match.days.length > 0) {
        return match.days.includes(dayOfWeek);
      }
      return true;
    }

    default:
      return false;
  }
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

export function evaluatePolicy(
  policy: PolicyConfig,
  request: EvaluationInput,
  context: EvaluationContext,
): EvaluationResult {
  try {
    // Validate schema_version
    if (policy.schema_version !== 1) {
      return {
        allowed: false,
        code: REASON_CODES.POLICY_INVALID_CONFIG,
        message: "Unsupported schema version",
        details: { reason: "unsupported_schema_version" },
      };
    }

    const rules = policy.rules ?? [];

    // Computed values
    const localStartDate = toLocalDate(request.startAt, context.timezone);
    const localEndDate = toLocalDate(request.endAt, context.timezone);
    const localStartMs = msSinceLocalMidnight(request.startAt, context.timezone);
    const localEndMs = msSinceLocalMidnight(request.endAt, context.timezone);
    const dayOfWeek = getDayOfWeek(localStartDate);
    const durationMs = request.endAt.getTime() - request.startAt.getTime();

    // Midnight normalization
    let spansMultipleDays = localEndDate !== localStartDate;
    let effectiveEndMinutesMs: number;

    if (spansMultipleDays && localEndMs === 0) {
      // End is exactly midnight next day → treat as same-day ending at 24:00
      spansMultipleDays = false;
      effectiveEndMinutesMs = 1440 * 60_000;
    } else {
      effectiveEndMinutesMs = localEndMs;
    }

    // Admin override: skip Steps 1-8
    if (context.skipPolicy) {
      const bufferBeforeMs =
        (policy.config["buffers"] as BuffersConfig | undefined)?.before_ms ?? 0;
      const bufferAfterMs = (policy.config["buffers"] as BuffersConfig | undefined)?.after_ms ?? 0;

      return {
        allowed: true,
        resolvedConfig: policy.config as unknown as ResolvedConfig,
        effectiveStartAt: new Date(request.startAt.getTime() - bufferBeforeMs),
        effectiveEndAt: new Date(request.endAt.getTime() + bufferAfterMs),
        bufferBeforeMs,
        bufferAfterMs,
      };
    }

    // ─── Step 1: Blackout pre-pass ─────────────────────────────────────────

    // Compute all local dates the booking overlaps (half-open: end exclusive)
    const overlapEndInstant = new Date(request.endAt.getTime() - 1);
    const lastOverlapDate = toLocalDate(overlapEndInstant, context.timezone);

    const overlapDates = dateRange(localStartDate, lastOverlapDate);

    for (const date of overlapDates) {
      const dow = getDayOfWeek(date);
      for (const rule of rules) {
        if (rule.closed !== true) continue;
        if (matchesCondition(rule.match, date, dow)) {
          return {
            allowed: false,
            code: REASON_CODES.BLACKOUT_WINDOW,
            message: `Date ${date} is closed`,
            details: { date },
          };
        }
      }
    }

    // ─── Step 2: Rule resolution (first-match-wins, start date only) ───────

    let matchedRule: Rule | null = null;
    for (const rule of rules) {
      if (rule.closed === true) continue; // Already handled in Step 1
      if (matchesCondition(rule.match, localStartDate, dayOfWeek)) {
        matchedRule = rule;
        break;
      }
    }

    // ─── Step 3: Open/closed determination ─────────────────────────────────

    if (matchedRule) {
      if (matchedRule.windows && matchedRule.windows.length > 0) {
        // Overnight rejection for windowed rules
        if (spansMultipleDays) {
          return {
            allowed: false,
            code: REASON_CODES.OVERNIGHT_NOT_SUPPORTED,
            message: "Booking spans midnight but matched rule has windows",
          };
        }

        // Check if booking fits within any window
        const fits = matchedRule.windows.some((w) => {
          const windowStartMs = timeToMs(w.start);
          const windowEndMs = timeToMs(w.end);
          return localStartMs >= windowStartMs && effectiveEndMinutesMs <= windowEndMs;
        });

        if (!fits) {
          return {
            allowed: false,
            code: REASON_CODES.CLOSED_BY_SCHEDULE,
            message: "Booking does not fit within any schedule window",
          };
        }
      }
      // No windows on matched rule → day is open 24h
    } else {
      // No rule matched → use default
      if (policy.default === "closed") {
        return {
          allowed: false,
          code: REASON_CODES.CLOSED_BY_SCHEDULE,
          message: "No matching rule and default is closed",
        };
      }
      // default: "open" → proceed
    }

    // ─── Step 4: Config resolution ─────────────────────────────────────────

    const baseConfig = (policy.config ?? {}) as Record<string, unknown>;
    const ruleConfig = (matchedRule?.config ?? {}) as Record<string, unknown>;
    const resolvedRaw = { ...baseConfig, ...ruleConfig };
    const resolved = {
      duration: resolvedRaw["duration"] as DurationConfig | undefined,
      grid: resolvedRaw["grid"] as GridConfig | undefined,
      booking_window: resolvedRaw["booking_window"] as BookingWindowConfig | undefined,
      buffers: resolvedRaw["buffers"] as BuffersConfig | undefined,
    };

    // ─── Step 5: Duration check ────────────────────────────────────────────

    if (resolved.duration) {
      if (durationMs <= 0) {
        return {
          allowed: false,
          code: REASON_CODES.INVALID_DURATION,
          message: "Duration must be positive",
        };
      }

      if (resolved.duration.allowed_ms && resolved.duration.allowed_ms.length > 0) {
        // allowed_ms takes precedence — only these durations are valid
        if (!resolved.duration.allowed_ms.includes(durationMs)) {
          return {
            allowed: false,
            code: REASON_CODES.INVALID_DURATION,
            message: `Duration ${durationMs}ms is not in allowed list`,
            details: { durationMs, allowed_ms: resolved.duration.allowed_ms },
          };
        }
      } else {
        // Fall back to min/max
        if (resolved.duration.min_ms !== undefined && durationMs < resolved.duration.min_ms) {
          return {
            allowed: false,
            code: REASON_CODES.INVALID_DURATION,
            message: `Duration ${durationMs}ms is below minimum ${resolved.duration.min_ms}ms`,
            details: { durationMs, min_ms: resolved.duration.min_ms },
          };
        }
        if (resolved.duration.max_ms !== undefined && durationMs > resolved.duration.max_ms) {
          return {
            allowed: false,
            code: REASON_CODES.INVALID_DURATION,
            message: `Duration ${durationMs}ms exceeds maximum ${resolved.duration.max_ms}ms`,
            details: { durationMs, max_ms: resolved.duration.max_ms },
          };
        }
      }
    }

    // ─── Step 6: Grid alignment ────────────────────────────────────────────

    if (resolved.grid) {
      const msSinceMidnight = msSinceLocalMidnight(request.startAt, context.timezone);
      if (msSinceMidnight % resolved.grid.interval_ms !== 0) {
        return {
          allowed: false,
          code: REASON_CODES.MISALIGNED_START_TIME,
          message: `Start time is not aligned to ${resolved.grid.interval_ms}ms grid`,
          details: {
            msSinceMidnight,
            interval_ms: resolved.grid.interval_ms,
            remainder: msSinceMidnight % resolved.grid.interval_ms,
          },
        };
      }
    }

    // ─── Step 7: Lead time ─────────────────────────────────────────────────

    if (resolved.booking_window?.min_lead_time_ms !== undefined) {
      const leadTime = request.startAt.getTime() - context.decisionTime.getTime();
      if (leadTime < resolved.booking_window.min_lead_time_ms) {
        return {
          allowed: false,
          code: REASON_CODES.LEAD_TIME_VIOLATION,
          message: "Booking too close to current time",
          details: {
            leadTimeMs: leadTime,
            min_lead_time_ms: resolved.booking_window.min_lead_time_ms,
          },
        };
      }
    }

    // ─── Step 8: Horizon ───────────────────────────────────────────────────

    if (resolved.booking_window?.max_lead_time_ms !== undefined) {
      const leadTime = request.startAt.getTime() - context.decisionTime.getTime();
      if (leadTime > resolved.booking_window.max_lead_time_ms) {
        return {
          allowed: false,
          code: REASON_CODES.HORIZON_EXCEEDED,
          message: "Booking too far in the future",
          details: {
            leadTimeMs: leadTime,
            max_lead_time_ms: resolved.booking_window.max_lead_time_ms,
          },
        };
      }
    }

    // ─── Step 9: Buffer computation (never rejects) ────────────────────────

    const bufferBeforeMs = resolved.buffers?.before_ms ?? 0;
    const bufferAfterMs = resolved.buffers?.after_ms ?? 0;
    const effectiveStartAt = new Date(request.startAt.getTime() - bufferBeforeMs);
    const effectiveEndAt = new Date(request.endAt.getTime() + bufferAfterMs);

    return {
      allowed: true,
      resolvedConfig: resolved,
      effectiveStartAt,
      effectiveEndAt,
      bufferBeforeMs,
      bufferAfterMs,
    };
  } catch (error) {
    return {
      allowed: false,
      code: REASON_CODES.POLICY_EVAL_ERROR,
      message: error instanceof Error ? error.message : "Unexpected evaluation error",
    };
  }
}
