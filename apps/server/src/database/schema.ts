import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import { AllocationStatus } from "@floyd-run/schema/types";

export interface WorkspacesTable {
  id: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ResourcesTable {
  id: string;
  workspaceId: string;
  timezone: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface AllocationsTable {
  id: string;
  workspaceId: string;
  resourceId: string;
  status: AllocationStatus;
  startAt: Date;
  endAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface IdempotencyKeysTable {
  id: string;
  workspaceId: string;
  key: string;
  path: string;
  method: string;
  payloadHash: string;
  responseStatus: number;
  responseBody: Record<string, unknown>;
  expiresAt: Date;
  createdAt: Generated<Date>;
}

export interface Database {
  allocations: AllocationsTable;
  idempotencyKeys: IdempotencyKeysTable;
  resources: ResourcesTable;
  workspaces: WorkspacesTable;
}

export type WorkspaceRow = Selectable<WorkspacesTable>;
export type NewWorkspace = Insertable<WorkspacesTable>;
export type WorkspaceUpdate = Updateable<WorkspacesTable>;

export type ResourceRow = Selectable<ResourcesTable>;
export type NewResource = Insertable<ResourcesTable>;
export type ResourceUpdate = Updateable<ResourcesTable>;

export type AllocationRow = Selectable<AllocationsTable>;
export type NewAllocation = Insertable<AllocationsTable>;
export type AllocationUpdate = Updateable<AllocationsTable>;

export type IdempotencyKeyRow = Selectable<IdempotencyKeysTable>;
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>;
