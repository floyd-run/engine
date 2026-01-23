import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import { AllocationStatus } from "@floyd-run/schema/types";

export interface LedgersTable {
  id: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ResourcesTable {
  id: string;
  ledgerId: string;
  timezone: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface AllocationsTable {
  id: string;
  ledgerId: string;
  resourceId: string;
  status: AllocationStatus;
  startAt: Date;
  endAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export type IdempotencyStatus = "in_progress" | "completed";

export interface IdempotencyKeysTable {
  ledgerId: string;
  key: string;
  path: string;
  method: string;
  payloadHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Generated<Date>;
}

export interface Database {
  allocations: AllocationsTable;
  idempotencyKeys: IdempotencyKeysTable;
  resources: ResourcesTable;
  ledgers: LedgersTable;
}

export type LedgerRow = Selectable<LedgersTable>;
export type NewLedger = Insertable<LedgersTable>;
export type LedgerUpdate = Updateable<LedgersTable>;

export type ResourceRow = Selectable<ResourcesTable>;
export type NewResource = Insertable<ResourcesTable>;
export type ResourceUpdate = Updateable<ResourcesTable>;

export type AllocationRow = Selectable<AllocationsTable>;
export type NewAllocation = Insertable<AllocationsTable>;
export type AllocationUpdate = Updateable<AllocationsTable>;

export type IdempotencyKeyRow = Selectable<IdempotencyKeysTable>;
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>;
