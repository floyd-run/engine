import { processPendingDeliveries } from "infra/webhooks";

const POLL_INTERVAL_MS = 5000; // 5 seconds
const BATCH_SIZE = 10;

let isRunning = false;

async function runWorker(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  console.log("[webhook-worker] Starting webhook delivery worker...");

  while (isRunning) {
    try {
      const processed = await processPendingDeliveries(BATCH_SIZE);
      if (processed > 0) {
        console.log(`[webhook-worker] Processed ${processed} deliveries`);
      }
    } catch (error) {
      console.error("[webhook-worker] Error processing deliveries:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

function stopWorker(): void {
  console.log("[webhook-worker] Stopping webhook delivery worker...");
  isRunning = false;
}

// Handle graceful shutdown
process.on("SIGTERM", stopWorker);
process.on("SIGINT", stopWorker);

// Start the worker
runWorker().catch((error) => {
  console.error("[webhook-worker] Fatal error:", error);
  process.exit(1);
});
