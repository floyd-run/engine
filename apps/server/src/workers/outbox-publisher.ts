import { db } from "database";
import { logger } from "infra/logger";
import type { InternalEvent } from "infra/event-bus";
import { computeHmacSignature } from "infra/crypto";

const POLL_INTERVAL_MS = 1000; // 1 second
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 25;

// Exponential backoff schedule (in seconds)
// 0s, 5s, 15s, 1m, 5m, 15m, 30m, 1h, 2h, 4h, then capped at 4h
const BACKOFF_SCHEDULE = [0, 5, 15, 60, 300, 900, 1800, 3600, 7200, 14400];
const MAX_BACKOFF_SECONDS = 14400; // 4 hours
const JITTER_FACTOR = 0.3; // ±30% jitter

let isRunning = false;
let publisherBackoffUntil: Date | null = null;

/**
 * Classify HTTP error as retryable or non-retryable
 * @internal Exported for testing
 */
export function isRetryableError(statusCode: number | null): boolean {
  if (!statusCode) {
    // Network errors (ECONNRESET, ETIMEDOUT, DNS failures, etc.)
    return true;
  }

  // Retryable HTTP status codes
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return true;
  }

  // Non-retryable: 4xx errors (except 408 and 429)
  // These indicate misconfiguration or permanent failures
  return false;
}

/**
 * Compute next retry time using exponential backoff with jitter
 * Returns null if error is non-retryable
 * @internal Exported for testing
 */
export function computeNextAttemptAt(attempt: number, statusCode: number | null): Date | null {
  // Check if error is retryable
  if (!isRetryableError(statusCode)) {
    return null; // Don't retry non-retryable errors
  }

  // Get base delay from schedule or use max
  const baseDelaySeconds =
    attempt < BACKOFF_SCHEDULE.length ? BACKOFF_SCHEDULE[attempt]! : MAX_BACKOFF_SECONDS;

  // Add jitter: random value between -30% and +30% of base delay
  const jitterAmount = baseDelaySeconds * JITTER_FACTOR * (Math.random() * 2 - 1);
  const delaySeconds = Math.max(0, baseDelaySeconds + jitterAmount);

  return new Date(Date.now() + delaySeconds * 1000);
}

/**
 * Extract HTTP status code from error message
 * @internal Exported for testing
 */
export function extractStatusCode(error: Error): number | null {
  const match = /HTTP (\d{3})/.exec(error.message);
  return match ? parseInt(match[1]!, 10) : null;
}

/**
 * Publish a single event to the cloud via HTTP.
 * Throws error with HTTP status for proper error classification.
 */
async function publishEvent(event: InternalEvent): Promise<void> {
  const ingestUrl = process.env["FLOYD_EVENT_INGEST_URL"];

  if (!ingestUrl) {
    logger.warn({ eventId: event.id }, "[outbox-publisher] FLOYD_EVENT_INGEST_URL not set");
    return;
  }

  const secret = process.env["FLOYD_ENGINE_SECRET"];
  const payload = JSON.stringify(event);
  const signature = secret ? computeHmacSignature(payload, secret) : "sha256=unsigned";

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Floyd-Signature": signature,
    },
    body: payload,
    signal: AbortSignal.timeout(30000), // 30 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unable to read error body");
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  logger.debug({ eventId: event.id, ingestUrl }, "[outbox-publisher] Event published successfully");
}

async function processOutboxBatch(): Promise<void> {
  // Circuit breaker: if publisher is backed off, skip this cycle
  if (publisherBackoffUntil && publisherBackoffUntil > new Date()) {
    logger.debug(
      { backoffUntil: publisherBackoffUntil },
      "[outbox-publisher] Publisher in backoff, skipping cycle",
    );
    return;
  }

  // Get events ready for publishing (no published_at, and next_attempt_at is due or null)
  const events = await db
    .selectFrom("outboxEvents")
    .selectAll()
    .where("publishedAt", "is", null)
    .where("publishAttempts", "<", MAX_ATTEMPTS)
    .where((eb) => eb.or([eb("nextAttemptAt", "is", null), eb("nextAttemptAt", "<=", new Date())]))
    .orderBy("createdAt", "asc")
    .limit(BATCH_SIZE)
    .execute();

  if (events.length === 0) {
    return;
  }

  logger.debug({ count: events.length }, "[outbox-publisher] Processing batch");

  let consecutiveFailures = 0;

  for (const event of events) {
    // Increment attempt counter
    await db
      .updateTable("outboxEvents")
      .set((eb) => ({
        publishAttempts: eb("publishAttempts", "+", 1),
      }))
      .where("id", "=", event.id)
      .execute();

    try {
      await publishEvent(event.payload as unknown as InternalEvent);

      // Success: mark as published
      await db
        .updateTable("outboxEvents")
        .set({
          publishedAt: new Date(),
          lastPublishError: null,
          nextAttemptAt: null,
        })
        .where("id", "=", event.id)
        .execute();

      logger.debug({ eventId: event.id }, "[outbox-publisher] Event published");
      consecutiveFailures = 0; // Reset on success
    } catch (error) {
      consecutiveFailures++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const statusCode = error instanceof Error ? extractStatusCode(error) : null;
      const isRetryable = isRetryableError(statusCode);

      const nextAttemptAt = computeNextAttemptAt(event.publishAttempts + 1, statusCode);

      // Check if we've exhausted retries or hit non-retryable error
      if (!isRetryable || event.publishAttempts + 1 >= MAX_ATTEMPTS) {
        logger.error(
          {
            eventId: event.id,
            attempts: event.publishAttempts + 1,
            error: errorMessage,
            statusCode,
            retryable: isRetryable,
          },
          isRetryable
            ? "[outbox-publisher] Event exhausted max attempts"
            : "[outbox-publisher] Event failed with non-retryable error",
        );

        // Mark as permanently failed (far-future date prevents retry)
        await db
          .updateTable("outboxEvents")
          .set({
            lastPublishError: errorMessage,
            nextAttemptAt: new Date("2099-12-31T23:59:59Z"), // Far future = permanently failed
          })
          .where("id", "=", event.id)
          .execute();

        // For non-retryable errors, trigger circuit breaker
        if (!isRetryable) {
          publisherBackoffUntil = new Date(Date.now() + 30000); // Back off for 30 seconds
          logger.warn(
            { backoffUntil: publisherBackoffUntil },
            "[outbox-publisher] Non-retryable error, activating circuit breaker",
          );
          break; // Stop processing more events
        }
      } else {
        // Schedule retry
        logger.warn(
          {
            eventId: event.id,
            attempts: event.publishAttempts + 1,
            error: errorMessage,
            statusCode,
            nextAttemptAt,
          },
          "[outbox-publisher] Event publish failed, will retry",
        );

        await db
          .updateTable("outboxEvents")
          .set({
            lastPublishError: errorMessage,
            nextAttemptAt,
          })
          .where("id", "=", event.id)
          .execute();
      }

      // Circuit breaker: if we've had 3 consecutive failures, back off
      if (consecutiveFailures >= 3) {
        publisherBackoffUntil = new Date(Date.now() + 30000); // Back off for 30 seconds
        logger.warn(
          { consecutiveFailures, backoffUntil: publisherBackoffUntil },
          "[outbox-publisher] Multiple consecutive failures, activating circuit breaker",
        );
        break; // Stop processing more events
      }
    }
  }
}

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  logger.info("[outbox-publisher] Starting outbox publisher worker...");

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (isRunning) {
    try {
      await processOutboxBatch();
    } catch (error) {
      logger.error(error, "[outbox-publisher] Error processing outbox");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function stopOutboxPublisher(): void {
  logger.info("[outbox-publisher] Stopping outbox publisher worker...");
  isRunning = false;
}

export function startOutboxPublisher(): void {
  const ingestUrl = process.env["FLOYD_EVENT_INGEST_URL"];

  if (!ingestUrl) {
    logger.info("[outbox-publisher] FLOYD_EVENT_INGEST_URL not set, running in self-hosted mode");
    return;
  }

  logger.info(`[outbox-publisher] Starting publisher, will ingest to ${ingestUrl}`);

  runWorker().catch((error: unknown) => {
    logger.error(error, "[outbox-publisher] Fatal error");
  });
}
