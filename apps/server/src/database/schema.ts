import type { Generated, Insertable, Selectable, Updateable } from "kysely";

// Allocation statuses
export type AllocationStatus = "HOLD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

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
  version: number;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface Database {
  allocations: AllocationsTable;
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
