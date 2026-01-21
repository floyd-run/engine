export interface Resource {
  id: string;
  workspaceId: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type AllocationStatus = "HOLD" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

export interface Allocation {
  id: string;
  workspaceId: string;
  resourceId: string;
  status: AllocationStatus;
  startAt: string;
  endAt: string;
  expiresAt: string | null;
  version: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
