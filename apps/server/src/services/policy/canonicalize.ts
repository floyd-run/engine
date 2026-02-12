/**
 * Canonicalizes a policy config for deterministic hashing.
 *
 * Rules:
 * - Sort object keys alphabetically at all nesting levels
 * - Preserve `rules` array order (semantic — first-match-wins)
 * - Sort `days` in canonical day order (monday → sunday)
 * - Sort `windows` by (start, end) ascending
 * - Sort `allowed_ms` ascending and deduplicate
 * - No extra whitespace
 */

import { createHash } from "crypto";

const CANONICAL_DAY_ORDER: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function sortDays(days: string[]): string[] {
  return [...days].sort((a, b) => (CANONICAL_DAY_ORDER[a] ?? 99) - (CANONICAL_DAY_ORDER[b] ?? 99));
}

function sortWindows(windows: Array<{ start: string; end: string }>): typeof windows {
  return [...windows].sort((a, b) => {
    const cmp = a.start.localeCompare(b.start);
    if (cmp !== 0) return cmp;
    return a.end.localeCompare(b.end);
  });
}

function sortAllowedMs(arr: number[]): number[] {
  return [...new Set(arr)].sort((a, b) => a - b);
}

function canonicalizeValue(key: string, value: unknown, parentKey?: string): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    // Special sorting for specific array keys
    if (key === "days") {
      return sortDays(value as string[]);
    }
    if (key === "windows") {
      return sortWindows(value as Array<{ start: string; end: string }>).map((w) =>
        canonicalizeObject(w),
      );
    }
    if (key === "allowed_ms") {
      return sortAllowedMs(value as number[]);
    }
    if (key === "rules") {
      // Preserve order! Rules are semantic (first-match-wins)
      return value.map((item) => {
        if (typeof item === "object" && item !== null) {
          return canonicalizeObject(item as Record<string, unknown>);
        }
        return item;
      });
    }
    return value.map((item) => {
      if (typeof item === "object" && item !== null) {
        return canonicalizeObject(item as Record<string, unknown>);
      }
      return item;
    });
  }

  if (typeof value === "object") {
    return canonicalizeObject(value as Record<string, unknown>);
  }

  return value;
}

function canonicalizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined) {
      sorted[key] = canonicalizeValue(key, value);
    }
  }

  return sorted;
}

/**
 * Returns the canonical JSON string of a policy config.
 * Two configs that differ only in key order, days order, windows order,
 * or whitespace produce the same canonical string.
 * Two configs with different rules order produce different strings.
 */
export function canonicalizePolicyConfig(config: Record<string, unknown>): string {
  const canonical = canonicalizeObject(config);
  return JSON.stringify(canonical);
}

/**
 * Returns the SHA-256 hex digest of a canonical JSON string.
 */
export function hashPolicyConfig(canonicalJson: string): string {
  return createHash("sha256").update(canonicalJson).digest("hex");
}
