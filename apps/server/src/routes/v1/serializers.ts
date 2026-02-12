import {
  AllocationRow,
  ResourceRow,
  LedgerRow,
  WebhookSubscriptionRow,
  PolicyRow,
  ServiceRow,
  BookingRow,
} from "database/schema";
import { Allocation, Resource, Ledger, Policy, Service, Booking } from "@floyd-run/schema/types";

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
    bookingId: allocation.bookingId,
    active: allocation.active,
    startAt: allocation.startAt.toISOString(),
    endAt: allocation.endAt.toISOString(),
    bufferBeforeMs: allocation.bufferBeforeMs,
    bufferAfterMs: allocation.bufferAfterMs,
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
  createdAt: string;
  updatedAt: string;
}

export function serializeWebhookSubscription(sub: WebhookSubscriptionRow): WebhookSubscription {
  return {
    id: sub.id,
    ledgerId: sub.ledgerId,
    url: sub.url,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

export function serializePolicy(policy: PolicyRow): Policy {
  return {
    id: policy.id,
    ledgerId: policy.ledgerId,
    config: policy.config as Record<string, unknown>,
    configHash: policy.configHash,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export function serializeService(service: ServiceRow, resourceIds: string[]): Service {
  return {
    id: service.id,
    ledgerId: service.ledgerId,
    name: service.name,
    policyId: service.policyId,
    resourceIds,
    metadata: service.metadata,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

export function serializeBooking(booking: BookingRow, allocations: AllocationRow[]): Booking {
  return {
    id: booking.id,
    ledgerId: booking.ledgerId,
    serviceId: booking.serviceId,
    policyId: booking.policyId,
    status: booking.status,
    expiresAt: booking.expiresAt?.toISOString() ?? null,
    allocations: allocations.map((a) => ({
      id: a.id,
      resourceId: a.resourceId,
      startAt: a.startAt.toISOString(),
      endAt: a.endAt.toISOString(),
      bufferBeforeMs: a.bufferBeforeMs,
      bufferAfterMs: a.bufferAfterMs,
      active: a.active,
    })),
    metadata: booking.metadata,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
