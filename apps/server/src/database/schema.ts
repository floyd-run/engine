import type { Generated, Selectable } from "kysely";

export interface Database {
  resources: ResourcesTable;
}

export interface ResourcesTable {
  id: Generated<string>;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type Resource = Selectable<ResourcesTable>;
