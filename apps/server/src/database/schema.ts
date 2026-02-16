import type { Generated, Insertable, Selectable, Updateable } from "kysely";
import type {
  BookingStatus,
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
  bookingId: string | null;
  active: boolean;
  startTime: Date;
  endTime: Date;
  bufferBeforeMs: number;
  bufferAfterMs: number;
  expiresAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ServicesTable {
  id: string;
  ledgerId: string;
  policyId: string | null;
  name: string;
  metadata: Record<string, unknown> | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface ServiceResourcesTable {
  serviceId: string;
  resourceId: string;
}

export interface BookingsTable {
  id: string;
  ledgerId: string;
  serviceId: string;
  policyId: string | null;
  status: BookingStatus;
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

export interface OutboxEventsTable {
  id: string;
  ledgerId: string;
  eventType: string;
  source: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  createdAt: Generated<Date>;
  publishedAt: Date | null;
  publishAttempts: number;
  nextAttemptAt: Date | null;
  lastPublishError: string | null;
}

export interface PoliciesTable {
  id: string;
  ledgerId: string;
  config: Record<string, unknown>;
  configHash: string;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
}

export interface Database {
  allocations: AllocationsTable;
  bookings: BookingsTable;
  services: ServicesTable;
  serviceResources: ServiceResourcesTable;
  idempotencyKeys: IdempotencyKeysTable;
  resources: ResourcesTable;
  ledgers: LedgersTable;
  policies: PoliciesTable;
  webhookSubscriptions: WebhookSubscriptionsTable;
  webhookDeliveries: WebhookDeliveriesTable;
  outboxEvents: OutboxEventsTable;
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

export type ServiceRow = Selectable<ServicesTable>;
export type NewService = Insertable<ServicesTable>;
export type ServiceUpdate = Updateable<ServicesTable>;

export type ServiceResourceRow = Selectable<ServiceResourcesTable>;

export type BookingRow = Selectable<BookingsTable>;
export type NewBooking = Insertable<BookingsTable>;
export type BookingUpdate = Updateable<BookingsTable>;

export type IdempotencyKeyRow = Selectable<IdempotencyKeysTable>;
export type NewIdempotencyKey = Insertable<IdempotencyKeysTable>;

export type WebhookSubscriptionRow = Selectable<WebhookSubscriptionsTable>;
export type NewWebhookSubscription = Insertable<WebhookSubscriptionsTable>;
export type WebhookSubscriptionUpdate = Updateable<WebhookSubscriptionsTable>;

export type WebhookDeliveryRow = Selectable<WebhookDeliveriesTable>;
export type NewWebhookDelivery = Insertable<WebhookDeliveriesTable>;

export type OutboxEventRow = Selectable<OutboxEventsTable>;
export type NewOutboxEvent = Insertable<OutboxEventsTable>;
export type OutboxEventUpdate = Updateable<OutboxEventsTable>;

export type PolicyRow = Selectable<PoliciesTable>;
export type NewPolicy = Insertable<PoliciesTable>;
export type PolicyUpdate = Updateable<PoliciesTable>;
