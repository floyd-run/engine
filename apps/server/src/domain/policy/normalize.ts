/**
 * Normalizes a policy config from authoring format (human-friendly units)
 * to canonical format (all durations in milliseconds, explicit day names).
 */

const CANONICAL_DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_SHORTHANDS: Record<string, readonly string[]> = {
  weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  weekends: ["saturday", "sunday"],
  everyday: CANONICAL_DAY_ORDER,
};

const UNIT_MULTIPLIERS: Record<string, number> = {
  _minutes: 60_000,
  _hours: 3_600_000,
  _days: 86_400_000,
};

/**
 * Converts friendly duration fields to _ms equivalents within an object.
 * If both _ms and a friendly unit exist for the same field, _ms takes precedence.
 */
function normalizeDurations(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const msKeys = new Set<string>();

  // First pass: collect all _ms keys and copy them
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith("_ms")) {
      result[key] = value;
      msKeys.add(key.slice(0, -3));
    }
  }

  // Second pass: convert friendly units, skip if _ms already present
  for (const [key, value] of Object.entries(obj)) {
    if (key.endsWith("_ms")) continue;

    let converted = false;
    for (const [suffix, multiplier] of Object.entries(UNIT_MULTIPLIERS)) {
      if (key.endsWith(suffix)) {
        const fieldPrefix = key.slice(0, -suffix.length);
        const msKey = `${fieldPrefix}_ms`;

        if (!msKeys.has(fieldPrefix)) {
          if (typeof value === "number") {
            result[msKey] = Math.round(value * multiplier);
          } else if (Array.isArray(value)) {
            result[msKey] = value.map((v: number) => Math.round(v * multiplier));
          }
        }
        converted = true;
        break;
      }
    }

    if (!converted) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Expands day shorthands (weekdays, weekends, everyday) to explicit day names.
 */
function expandDays(days: string[]): string[] {
  const expanded: string[] = [];
  for (const day of days) {
    const shorthand = DAY_SHORTHANDS[day];
    if (shorthand) {
      expanded.push(...shorthand);
    } else {
      expanded.push(day);
    }
  }
  // Deduplicate while preserving order
  return [...new Set(expanded)];
}

function normalizeConfigSection(config: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (
      (key === "duration" ||
        key === "grid" ||
        key === "lead_time" ||
        key === "buffers" ||
        key === "hold") &&
      typeof value === "object" &&
      value !== null
    ) {
      result[key] = normalizeDurations(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function normalizeMatch(match: Record<string, unknown>): Record<string, unknown> {
  const result = { ...match };
  if (Array.isArray(result["days"])) {
    result["days"] = expandDays(result["days"] as string[]);
  }
  return result;
}

function normalizeRule(rule: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rule)) {
    if (key === "match" && typeof value === "object" && value !== null) {
      result[key] = normalizeMatch(value as Record<string, unknown>);
    } else if (key === "overrides" && typeof value === "object" && value !== null) {
      result[key] = normalizeConfigSection(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export function normalizePolicyConfig(authoring: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(authoring)) {
    if (key === "constraints" && typeof value === "object" && value !== null) {
      result[key] = normalizeConfigSection(value as Record<string, unknown>);
    } else if (key === "rules" && Array.isArray(value)) {
      result[key] = value.map((rule) => normalizeRule(rule as Record<string, unknown>));
    } else {
      result[key] = value;
    }
  }

  return result;
}
