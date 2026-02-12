import type { Allocation, Resource, Ledger, AvailabilityItem } from "@floyd-run/schema/types";

// Generic API response type that can represent both success and error responses
export interface ApiResponse<T = unknown> {
  data: T;
  meta?: { serverTime: string };
  error?: { code: string; message?: string };
}

// Specific response types that allow for error responses in tests
export type AllocationResponse = ApiResponse<Allocation>;
export type ResourceResponse = ApiResponse<Resource>;
export type LedgerResponse = ApiResponse<Ledger>;
export type AvailabilityResponse = ApiResponse<AvailabilityItem[]>;
export type ListResponse<T> = ApiResponse<T[]>;
