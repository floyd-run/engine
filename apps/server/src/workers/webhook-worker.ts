import { processPendingDeliveries } from "infra/webhooks";
import { logger } from "infra/logger";

const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 10;

let isRunning = false;

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  logger.info("[webhook-worker] Starting webhook delivery worker...");

  while (isRunning) {
    try {
      const processed = await processPendingDeliveries(BATCH_SIZE);
      if (processed > 0) {
        logger.info(`[webhook-worker] Processed ${processed} deliveries`);
      }
    } catch (error) {
      logger.error(error, "[webhook-worker] Error processing deliveries");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

export function stopWebhookWorker(): void {
  logger.info("[webhook-worker] Stopping webhook delivery worker...");
  isRunning = false;
}

export function startWebhookWorker(): void {
  runWorker().catch((error: unknown) => {
    logger.error(error, "[webhook-worker] Fatal error");
  });
}
