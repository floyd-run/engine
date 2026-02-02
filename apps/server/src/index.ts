import { serve } from "@hono/node-server";
import { config } from "config";
import { logger } from "infra/logger";
import { startWebhookWorker, stopWebhookWorker } from "./workers/webhook-worker";
import { startExpirationWorker, stopExpirationWorker } from "./workers/expiration-worker";

async function main() {
  const { default: app } = await import("./app");

  // Start background workers
  startWebhookWorker();
  startExpirationWorker();

  const server = serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      logger.info(`Server started at ${info.port}`);
    },
  );

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    stopWebhookWorker();
    stopExpirationWorker();
    server.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => logger.error(err));
