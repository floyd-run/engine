import { db } from "database";
import z from "zod";
import { createService } from "lib/service";
import { generateId, isValidId } from "lib/id";
import { AllocationStatus } from "database/schema";

const allocationStatuses: AllocationStatus[] = ["HOLD", "CONFIRMED", "CANCELLED", "EXPIRED"];

export default createService({
  input: z.object({
    workspaceId: z
      .string()
      .refine((id) => isValidId(id, "ws"), { message: "Invalid workspace ID" }),
    resourceId: z
      .string()
      .refine((id) => isValidId(id, "res"), { message: "Invalid resource ID" }),
    status: z.enum(allocationStatuses as [AllocationStatus, ...AllocationStatus[]]),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    expiresAt: z.coerce.date().nullable().optional(),
    version: z.number().int().min(1).default(1),
    groupRef: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  execute: async (input) => {
    const allocation = await db
      .insertInto("allocations")
      .values({
        id: generateId("alloc"),
        workspaceId: input.workspaceId,
        resourceId: input.resourceId,
        status: input.status,
        startAt: input.startAt,
        endAt: input.endAt,
        expiresAt: input.expiresAt ?? null,
        version: input.version,
        groupRef: input.groupRef ?? null,
        metadata: input.metadata ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { allocation };
  },
});
