import z from "zod";
import { isValidId } from "@floyd-run/utils";

export const query = z
  .object({
    ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
    resourceIds: z.array(
      z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }),
    ),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

// ─── Service Availability ────────────────────────────────────────────────────

const serviceAvailabilityBase = {
  ledgerId: z.string().refine((id) => isValidId(id, "ldg"), { message: "Invalid ledger ID" }),
  serviceId: z.string().refine((id) => isValidId(id, "svc"), { message: "Invalid service ID" }),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  resourceIds: z
    .array(z.string().refine((id) => isValidId(id, "rsc"), { message: "Invalid resource ID" }))
    .optional(),
  includeUnavailable: z.boolean().default(false),
};

export const slots = z.object({
  ...serviceAvailabilityBase,
  durationMs: z.number().int().positive(),
});

export const windows = z.object({
  ...serviceAvailabilityBase,
});
