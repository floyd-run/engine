import { faker } from "@faker-js/faker";
import { db } from "database";
import { generateId } from "@floyd-run/utils";
import { randomBytes } from "crypto";
import { createLedger } from "./ledger.factory";

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export async function createWebhookSubscription(overrides?: {
  ledgerId?: string;
  url?: string;
  secret?: string;
  eventTypes?: string[] | null;
  enabled?: boolean;
}) {
  let ledgerId = overrides?.ledgerId;
  if (!ledgerId) {
    const { ledger } = await createLedger();
    ledgerId = ledger.id;
  }

  const subscription = await db
    .insertInto("webhookSubscriptions")
    .values({
      id: generateId("whs"),
      ledgerId,
      url: overrides?.url ?? faker.internet.url(),
      secret: overrides?.secret ?? generateSecret(),
      eventTypes: overrides?.eventTypes ?? null,
      enabled: overrides?.enabled ?? true,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { subscription, ledgerId };
}

export async function createWebhookDelivery(overrides: {
  subscriptionId: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  status?: "pending" | "in_flight" | "succeeded" | "failed" | "exhausted";
  attempts?: number;
  maxAttempts?: number;
  nextAttemptAt?: Date | null;
  lastError?: string | null;
  lastStatusCode?: number | null;
}) {
  const delivery = await db
    .insertInto("webhookDeliveries")
    .values({
      id: generateId("whd"),
      subscriptionId: overrides.subscriptionId,
      eventType: overrides.eventType ?? "allocation.created",
      payload: overrides.payload ?? { id: generateId("whd"), type: "allocation.created", data: {} },
      status: overrides.status ?? "pending",
      attempts: overrides.attempts ?? 0,
      maxAttempts: overrides.maxAttempts ?? 5,
      nextAttemptAt: overrides.nextAttemptAt ?? new Date(),
      lastError: overrides.lastError ?? null,
      lastStatusCode: overrides.lastStatusCode ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return { delivery };
}
