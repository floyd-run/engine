import { AllocationRow, ResourceRow, WorkspaceRow } from "database/schema";
import { Allocation, Resource, Workspace } from "@floyd-run/schema/types";

export function serializeResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    workspaceId: resource.workspaceId,
    timezone: resource.timezone,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

export function serializeWorkspace(workspace: WorkspaceRow): Workspace {
  return {
    id: workspace.id,
    createdAt: workspace.createdAt.toISOString(),
    updatedAt: workspace.updatedAt.toISOString(),
  };
}

export function serializeAllocation(allocation: AllocationRow): Allocation {
  return {
    id: allocation.id,
    workspaceId: allocation.workspaceId,
    resourceId: allocation.resourceId,
    status: allocation.status,
    startAt: allocation.startAt.toISOString(),
    endAt: allocation.endAt.toISOString(),
    expiresAt: allocation.expiresAt?.toISOString() ?? null,
    metadata: allocation.metadata,
    createdAt: allocation.createdAt.toISOString(),
    updatedAt: allocation.updatedAt.toISOString(),
  };
}
