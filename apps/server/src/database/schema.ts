import type { Generated, Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  resources: ResourcesTable;
  workspaces: WorkspacesTable;
}

export interface ResourcesTable {
  id: string;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export type ResourceRow = Selectable<ResourcesTable>;
export type NewResource = Insertable<ResourcesTable>;

export interface WorkspacesTable {
  id: string;
  description: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export type WorkspaceRow = Selectable<WorkspacesTable>;
export type NewWorkspace = Insertable<WorkspacesTable>;
export type WorkspaceUpdate = Updateable<WorkspacesTable>;
