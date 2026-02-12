import { createHmac } from "crypto";
import type { Kysely, Transaction } from "kysely";
import type { Database } from "database/schema";
import { db } from "database";
import { generateId } from "@floyd-run/utils";

// Event types for webhooks
export type WebhookEventType =
  | "allocation.created"
  | "allocation.deleted"
  | "booking.created"
  | "booking.confirmed"
  | "booking.cancelled"
  | "booking.expired";

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  ledgerId: string;
  createdAt: string;
  data: Record<string, unknown>;
}

/**
 * Enqueue webhook deliveries for all subscriptions that match the event.
 * MUST be called within the same transaction as the data mutation.
 * Call sites are responsible for serializing their own payload data.
 */
export async function enqueueWebhookEvent(
  trx: Transaction<Database> | Kysely<Database>,
  eventType: WebhookEventType,
  ledgerId: string,
  data: Record<string, unknown>,
): Promise<void> {
  // Find all subscriptions for this ledger
  const subscriptions = await trx
    .selectFrom("webhookSubscriptions")
    .selectAll()
    .where("ledgerId", "=", ledgerId)
    .execute();

  if (subscriptions.length === 0) {
    return;
  }

  const now = new Date();

  // Create a delivery record for each subscription
  // The delivery ID serves as the event ID in the payload
  const deliveries = subscriptions.map((sub) => {
    const deliveryId = generateId("whd");
    const event: WebhookEvent = {
      id: deliveryId,
      type: eventType,
      ledgerId,
      createdAt: now.toISOString(),
      data,
    };
    return {
      id: deliveryId,
      subscriptionId: sub.id,
      eventType,
      payload: event as unknown as Record<string, unknown>,
      status: "pending" as const,
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: now,
      lastError: null,
      lastStatusCode: null,
    };
  });

  await trx.insertInto("webhookDeliveries").values(deliveries).execute();
}

/**
 * Compute HMAC-SHA256 signature for webhook payload.
 * Header format: `sha256=<hex>`
 */
export function computeWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Process pending webhook deliveries.
 * Should be called by a background worker.
 */
export async function processPendingDeliveries(batchSize = 10): Promise<number> {
  const now = new Date();

  // Atomically claim a batch of pending deliveries using FOR UPDATE SKIP LOCKED
  const deliveries = await db.transaction().execute(async (trx) => {
    const rows = await trx
      .selectFrom("webhookDeliveries")
      .selectAll()
      .where((eb) => eb.or([eb("status", "=", "pending"), eb("status", "=", "failed")]))
      .where((eb) => eb.or([eb("nextAttemptAt", "is", null), eb("nextAttemptAt", "<=", now)]))
      .orderBy("nextAttemptAt", "asc")
      .limit(batchSize)
      .forUpdate()
      .skipLocked()
      .execute();

    if (rows.length === 0) return [];

    const ids = rows.map((d) => d.id);
    await trx
      .updateTable("webhookDeliveries")
      .set({ status: "in_flight" })
      .where("id", "in", ids)
      .execute();

    return rows;
  });

  if (deliveries.length === 0) {
    return 0;
  }

  let processed = 0;

  for (const delivery of deliveries) {
    try {
      // Get subscription for URL and secret
      const subscription = await db
        .selectFrom("webhookSubscriptions")
        .selectAll()
        .where("id", "=", delivery.subscriptionId)
        .executeTakeFirst();

      if (!subscription) {
        // Subscription deleted, mark as exhausted
        await db
          .updateTable("webhookDeliveries")
          .set({
            status: "exhausted",
            lastError: "Subscription not found",
          })
          .where("id", "=", delivery.id)
          .execute();
        processed++;
        continue;
      }

      const payloadString = JSON.stringify(delivery.payload);
      const signature = computeWebhookSignature(payloadString, subscription.secret);

      // Attempt delivery
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Floyd-Signature": signature,
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (response.ok) {
        // Success
        await db
          .updateTable("webhookDeliveries")
          .set({
            status: "succeeded",
            attempts: delivery.attempts + 1,
            lastStatusCode: response.status,
            lastError: null,
          })
          .where("id", "=", delivery.id)
          .execute();
      } else {
        // HTTP error - schedule retry
        await handleDeliveryFailure(
          delivery.id,
          delivery.attempts + 1,
          delivery.maxAttempts,
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
        );
      }
    } catch (error) {
      // Network error - schedule retry
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await handleDeliveryFailure(
        delivery.id,
        delivery.attempts + 1,
        delivery.maxAttempts,
        errorMessage,
        null,
      );
    }

    processed++;
  }

  return processed;
}

async function handleDeliveryFailure(
  deliveryId: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string,
  statusCode: number | null,
): Promise<void> {
  if (attempts >= maxAttempts) {
    // Exhausted all retries
    await db
      .updateTable("webhookDeliveries")
      .set({
        status: "exhausted",
        attempts,
        lastError: errorMessage,
        lastStatusCode: statusCode,
        nextAttemptAt: null,
      })
      .where("id", "=", deliveryId)
      .execute();
  } else {
    // Schedule retry with exponential backoff
    // Delays: 1min, 5min, 30min, 2hr, 12hr
    const delayMinutes = [1, 5, 30, 120, 720][attempts - 1] ?? 720;
    const nextAttemptAt = new Date();
    nextAttemptAt.setMinutes(nextAttemptAt.getMinutes() + delayMinutes);

    await db
      .updateTable("webhookDeliveries")
      .set({
        status: "failed",
        attempts,
        lastError: errorMessage,
        lastStatusCode: statusCode,
        nextAttemptAt,
      })
      .where("id", "=", deliveryId)
      .execute();
  }
}
