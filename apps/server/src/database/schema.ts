import type { Generated, Insertable, Selectable } from "kysely";

export interface Database {
  resources: ResourcesTable;
}

export interface ResourcesTable {
  id: Generated<string>;
  name: string;
  timezone: string;
  metadata: Record<string, unknown>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export type ResourceRow = Selectable<ResourcesTable>;
