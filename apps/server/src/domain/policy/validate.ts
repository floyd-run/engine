/**
 * Semantic validation of a normalized (canonical) policy config.
 * Produces non-fatal warnings for likely misconfigurations.
 *
 * Hard rejections (invalid values, types, ranges) are handled by Zod
 * at the input schema level. This function handles semantic checks
 * that Zod can't express.
 */

export interface PolicyWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface RuleMatch {
  type: string;
  days?: string[];
  date?: string;
}

interface Rule {
  match: RuleMatch;
  closed?: true;
  windows?: { start: string; end: string }[];
  overrides?: Record<string, unknown>;
}

export function validatePolicyConfig(config: Record<string, unknown>): {
  warnings: PolicyWarning[];
} {
  const warnings: PolicyWarning[] = [];
  const rules = (config["rules"] as Rule[] | undefined) ?? [];
  const defaultValue = config["default_availability"] as string;

  // Track which days have been seen in weekly rules (for unreachable detection)
  const seenWeeklyDays = new Set<string>();

  // Track which dates have been seen in date rules
  const seenDates = new Set<string>();

  let hasWindowedRule = false;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    const match = rule.match;

    if (match.type === "weekly" && match.days) {
      const duplicateDays = match.days.filter((d) => seenWeeklyDays.has(d));
      if (duplicateDays.length > 0) {
        warnings.push({
          code: "unreachable_weekly_rule",
          message: `Rule ${i}: days [${duplicateDays.join(", ")}] already matched by an earlier weekly rule`,
          details: { ruleIndex: i, days: duplicateDays },
        });
      }
      for (const d of match.days) {
        seenWeeklyDays.add(d);
      }
    }

    if (match.type === "date" && match.date) {
      if (seenDates.has(match.date)) {
        warnings.push({
          code: "unreachable_date_rule",
          message: `Rule ${i}: date ${match.date} already matched by an earlier date rule`,
          details: { ruleIndex: i, date: match.date },
        });
      }
      seenDates.add(match.date);
    }

    if (rule.windows && rule.windows.length > 0) {
      hasWindowedRule = true;
    }

    // Overrides-only rule (no windows, no closed) with default_availability: "closed"
    if (!rule.closed && !rule.windows && rule.overrides && defaultValue === "closed") {
      warnings.push({
        code: "overrides_only_with_closed_default",
        message: `Rule ${i}: has overrides but no windows. Matched dates will be open 24h, which may be unintentional with default_availability:"closed"`,
        details: { ruleIndex: i },
      });
    }
  }

  // default: "open" with windowed rules
  if (defaultValue === "open" && hasWindowedRule) {
    warnings.push({
      code: "open_default_with_windows",
      message:
        'default_availability is "open" but some rules have windows. Matched dates follow rule windows; unmatched dates are open 24h',
    });
  }

  return { warnings };
}
