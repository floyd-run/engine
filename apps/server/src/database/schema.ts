import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import {
  AllocationStatus,
  IdempotencyStatus,
  WebhookDeliveryStatus,
} from "@floyd-run/schema/types";

export interface LedgersTable {
  id: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ResourcesTable {
  id: string;
  ledgerId: string;
  timezone: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface AllocationsTable {
  id: string;
  ledgerId: string;
  resourceId: string;
  status: AllocationStatus;
  startAt: Date;
  endAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface IdempotencyKeysTable {
  ledgerId: string;
  key: string;
  path: string;
  method: string;
  payloadHash: string;
  status: IdempotencyStatus;
  responseStatus: number | null;
  responseBody: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Generated<Date>;
}

export interface WebhookSubscriptionsTable {
  id: string;
  ledgerId: string;
  url: string;
  secret: string;
  eventTypes: string[] | null; // NULL = all events
  enabled: boolean;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface WebhookDeliveriesTable {
  id: string;
  subscriptionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  lastError: string | null;
  lastStatusCode: number | null;
  createdAt: Generated<Date>;
}

export interface Database {
  allocations: AllocationsTable;
  idempotencyKeys: IdempotencyKeysTable;
  resources: ResourcesTable;
  ledgers: LedgersTable;
  webhookSubscriptions: WebhookSubscriptionsTable;
  webhookDeliveries: WebhookDeliveriesTable;
}

export type LedgerRow = Selectable<LedgersTable>;
export type NewLedger = Insertable<LedgersTable>;
export type LedgerUpdate = Updateable<LedgersTable>;

export type ResourceRow = Selectable<ResourcesTable>;
export type NewResource = Insertable<ResourcesTable>;
export type ResourceUpdate = Updateable<ResourcesTable>;

export type AllocationRow = Selectable<AllocationsTable>;
export type NewAllocation = Insertable<AllocationsTable>;
export type AllocationUpdate = Updateable<AllocationsTable>;

export type IdempotencyKeyRow = Selectable<IdempotencyKeysTable>;
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>;

export type WebhookSubscriptionRow = Selectable<WebhookSubscriptionsTable>;
export type NewWebhookSubscription = Insertable<WebhookSubscriptionsTable>;
export type WebhookSubscriptionUpdate = Updateable<WebhookSubscriptionsTable>;

export type WebhookDeliveryRow = Selectable<WebhookDeliveriesTable>;
export type NewWebhookDelivery = Insertable<WebhookDeliveriesTable>;
