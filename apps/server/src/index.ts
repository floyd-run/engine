import { serve } from "@hono/node-server";
import { config } from "config";
import { logger } from "infra/logger";

async function main() {
const { default: app } = await import("./app");

  serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      logger.info(`Server started at ${info.port}`);
    },
  );
}

main().catch(logger.error);
