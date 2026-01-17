import { ResourceRow } from "database/schema";
import { Resource } from "@floyd-run/types";

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
