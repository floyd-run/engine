import type { Allocation, Resource, Workspace } from "@floyd-run/schema/types";

export interface ApiResponse<T = unknown> {
  data: T;
  meta?: { serverTime: string };
  error?: { code: string; message?: string };
}

export type AllocationResponse = ApiResponse<Allocation>;
export type ResourceResponse = ApiResponse<Resource>;
export type WorkspaceResponse = ApiResponse<Workspace>;
export type ListResponse<T> = ApiResponse<T[]>;
