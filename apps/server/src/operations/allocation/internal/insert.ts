import type { Transaction } from "kysely";
import type { Database, AllocationRow } from "database/schema";
import { generateId } from "@floyd-run/utils";
import { ConflictError } from "lib/errors";

interface InsertAllocationParams {
  ledgerId: string;
  resourceId: string;
  bookingId: string | null;
  startTime: Date;
  endTime: Date;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  serverTime: Date;
}

export async function insertAllocation(
  trx: Transaction<Database>,
  params: InsertAllocationParams,
): Promise<AllocationRow> {
  // 1. Check for overlapping active allocations (not expired)
  const conflicting = await trx
    .selectFrom("allocations")
    .select("id")
    .where("resourceId", "=", params.resourceId)
    .where("active", "=", true)
    .where((eb) => eb.or([eb("expiresAt", "is", null), eb("expiresAt", ">", params.serverTime)]))
    .where("startTime", "<", params.endTime)
    .where("endTime", ">", params.startTime)
    .execute();

  if (conflicting.length > 0) {
    throw new ConflictError("allocation.overlap", {
      conflictingAllocationIds: conflicting.map((a) => a.id),
    });
  }

  // 2. Insert the allocation
  const allocation = await trx
    .insertInto("allocations")
    .values({
      id: generateId("alc"),
      ledgerId: params.ledgerId,
      resourceId: params.resourceId,
      bookingId: params.bookingId,
      active: true,
      startTime: params.startTime,
      endTime: params.endTime,
      bufferBeforeMs: params.bufferBeforeMs,
      bufferAfterMs: params.bufferAfterMs,
      expiresAt: params.expiresAt,
      metadata: params.metadata,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return allocation;
}
