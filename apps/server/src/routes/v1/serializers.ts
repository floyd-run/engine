import {
  AllocationRow,
  ResourceRow,
  LedgerRow,
  WebhookSubscriptionRow,
  PolicyRow,
} from "database/schema";
import { Allocation, Resource, Ledger, Policy } from "@floyd-run/schema/types";

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

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Recursively convert camelCase keys back to snake_case (undoes CamelCasePlugin on JSONB) */
function snakeCaseKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(snakeCaseKeys);
  }
  if (obj !== null && typeof obj === "object" && !(obj instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[camelToSnake(key)] = snakeCaseKeys(value);
    }
    return result;
  }
  return obj;
}

export function serializePolicy(policy: PolicyRow): Policy {
  return {
    id: policy.id,
    ledgerId: policy.ledgerId,
    config: snakeCaseKeys(policy.config) as Record<string, unknown>,
    configHash: policy.configHash,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}
