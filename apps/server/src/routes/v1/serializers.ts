import {
  AllocationRow,
  ResourceRow,
  LedgerRow,
  WebhookSubscriptionRow,
  WebhookDeliveryRow,
} from "database/schema";
import { Allocation, Resource, Ledger } from "@floyd-run/schema/types";

export function serializeResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    ledgerId: resource.ledgerId,
    timezone: resource.timezone,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

export function serializeLedger(ledger: LedgerRow): Ledger {
  return {
    id: ledger.id,
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
  };
}

export function serializeAllocation(allocation: AllocationRow): Allocation {
  return {
    id: allocation.id,
    ledgerId: allocation.ledgerId,
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

export interface WebhookSubscription {
  id: string;
  ledgerId: string;
  url: string;
  eventTypes: string[] | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  lastStatusCode: number | null;
  createdAt: string;
}

export function serializeWebhookSubscription(sub: WebhookSubscriptionRow): WebhookSubscription {
  return {
    id: sub.id,
    ledgerId: sub.ledgerId,
    url: sub.url,
    eventTypes: sub.eventTypes,
    enabled: sub.enabled,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

export function serializeWebhookDelivery(delivery: WebhookDeliveryRow): WebhookDelivery {
  return {
    id: delivery.id,
    subscriptionId: delivery.subscriptionId,
    eventType: delivery.eventType,
    status: delivery.status,
    attempts: delivery.attempts,
    maxAttempts: delivery.maxAttempts,
    nextAttemptAt: delivery.nextAttemptAt?.toISOString() ?? null,
    lastError: delivery.lastError,
    lastStatusCode: delivery.lastStatusCode,
    createdAt: delivery.createdAt.toISOString(),
  };
}
