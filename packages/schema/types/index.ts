import { AllocationStatus } from "../constants";
import { ConstantType } from "./utils";

export type AllocationStatus = ConstantType<typeof AllocationStatus>;

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

export interface Allocation {
  id: string;
  workspaceId: string;
  resourceId: string;
  status: AllocationStatus;
  startAt: string;
  endAt: string;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
