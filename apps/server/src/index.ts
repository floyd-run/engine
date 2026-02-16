import { serve } from "@hono/node-server";
import { config } from "config";
import { logger } from "infra/logger";
import { startExpirationWorker, stopExpirationWorker } from "./workers/expiration-worker";
import { startOutboxPublisher, stopOutboxPublisher } from "./workers/outbox-publisher";

async function main() {
  const { default: app } = await import("./app");

  // Start background workers
  startExpirationWorker();
  startOutboxPublisher();

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
    stopExpirationWorker();
    stopOutboxPublisher();
    server.close();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err: unknown) => {
  logger.error(err);
});
