import { AllocationRow, ResourceRow, LedgerRow, WebhookSubscriptionRow } from "database/schema";
import { Allocation, Resource, Ledger } from "@floyd-run/schema/types";

export function serializeResource(resource: ResourceRow): Resource {
  return {
    id: resource.id,
    ledgerId: resource.ledgerId,
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
