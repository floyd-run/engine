import { ResourceRow, WorkspaceRow } from "database/schema";
import { Resource, Workspace } from "@floyd-run/types";

export function serializeResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    name: resource.name,
    timezone: resource.timezone,
    metadata: resource.metadata,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

export function serializeWorkspace(workspace: WorkspaceRow): Workspace {
  return {
    id: workspace.id,
    description: workspace.description,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}
