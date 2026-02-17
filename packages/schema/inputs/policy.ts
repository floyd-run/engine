import z from "zod";
import { isValidId } from "@floyd-run/utils";
import { ScheduleDefault } from "../constants";

// Time string: HH:MM (00:00-23:59) or 24:00 for end-of-day
const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "Invalid time format (HH:MM or 24:00)");

// Convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  if (time === "24:00") return 1440;
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

// Time window with validation
const timeWindowSchema = z
  .object({
    start: timeStringSchema,
    end: timeStringSchema,
  })
  .refine((w) => w.start !== "24:00", { message: "start cannot be 24:00" })
  .refine((w) => timeToMinutes(w.end) > timeToMinutes(w.start), {
    message: "end must be after start",
  });

// Day names
const dayNames = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
type DayName = (typeof dayNames)[number];

const dayShorthands = ["weekdays", "weekends", "everyday"] as const;
const dayOrShorthand = z.enum([...dayNames, ...dayShorthands]);

// Duration section (authoring: accepts friendly units)
const durationAuthoringSchema = z
  .object({
    min_ms: z.number().int().positive().optional(),
    max_ms: z.number().int().positive().optional(),
    allowed_ms: z.array(z.number().int().positive()).nonempty().optional(),
    min_minutes: z.number().positive().optional(),
    max_minutes: z.number().positive().optional(),
    allowed_minutes: z.array(z.number().positive()).nonempty().optional(),
    min_hours: z.number().positive().optional(),
    max_hours: z.number().positive().optional(),
    min_days: z.number().positive().optional(),
    max_days: z.number().positive().optional(),
  })
  .passthrough();

// Grid section (authoring)
const gridAuthoringSchema = z
  .object({
    interval_ms: z.number().int().positive().optional(),
    interval_minutes: z.number().positive().optional(),
  })
  .passthrough();

// Lead time section (authoring)
const leadTimeAuthoringSchema = z
  .object({
    min_ms: z.number().int().nonnegative().optional(),
    max_ms: z.number().int().nonnegative().optional(),
    min_minutes: z.number().nonnegative().optional(),
    max_minutes: z.number().nonnegative().optional(),
    min_hours: z.number().nonnegative().optional(),
    max_hours: z.number().nonnegative().optional(),
    min_days: z.number().nonnegative().optional(),
    max_days: z.number().nonnegative().optional(),
  })
  .passthrough();

// Buffers section (authoring)
const buffersAuthoringSchema = z
  .object({
    before_ms: z.number().int().nonnegative().optional(),
    after_ms: z.number().int().nonnegative().optional(),
    before_minutes: z.number().nonnegative().optional(),
    after_minutes: z.number().nonnegative().optional(),
  })
  .passthrough();

// Hold section (authoring)
const holdAuthoringSchema = z
  .object({
    duration_ms: z.number().int().positive().optional(),
    duration_minutes: z.number().positive().optional(),
  })
  .passthrough();

// Constraints section (authoring)
const constraintsAuthoringSchema = z
  .object({
    duration: durationAuthoringSchema.optional(),
    grid: gridAuthoringSchema.optional(),
    lead_time: leadTimeAuthoringSchema.optional(),
    buffers: buffersAuthoringSchema.optional(),
    hold: holdAuthoringSchema.optional(),
  })
  .passthrough();

// Match conditions
const weeklyMatchSchema = z.object({
  type: z.literal("weekly"),
  days: z.array(dayOrShorthand).nonempty(),
});

const dateMatchSchema = z.object({
  type: z.literal("date"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
});

const dateRangeMatchSchema = z
  .object({
    type: z.literal("date_range"),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    days: z.array(dayOrShorthand).nonempty().optional(),
  })
  .refine((m) => m.from <= m.to, { message: "from must be <= to" });

const matchSchema = z.discriminatedUnion("type", [
  weeklyMatchSchema,
  dateMatchSchema,
  dateRangeMatchSchema,
]);

// Rule schema (authoring)
const ruleSchema = z
  .object({
    match: matchSchema,
    closed: z.literal(true).optional(),
    windows: z.array(timeWindowSchema).nonempty().optional(),
    overrides: constraintsAuthoringSchema.optional(),
  })
  .refine(
    (rule) => {
      if (rule.closed === true) {
        return rule.windows === undefined && rule.overrides === undefined;
      }
      return true;
    },
    { message: "closed rule must not have windows or overrides" },
  );

// Full policy config schema (authoring format)
const policyConfigSchema = z
  .object({
    schema_version: z.literal(1),
    default_availability: z.enum([ScheduleDefault.OPEN, ScheduleDefault.CLOSED]),
    constraints: constraintsAuthoringSchema,
    rules: z.array(ruleSchema).default([]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const create = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().max(255).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  config: policyConfigSchema,
});

export const update = z.object({
  id: z.string().refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  name: z.string().max(255).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  config: policyConfigSchema,
});

export const get = z.object({
  id: z.string().refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const list = z.object({
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});

export const remove = z.object({
  id: z.string().refine((id) => isValidId(id, "pol"), { message: "Invalid policy ID" }),
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
});
