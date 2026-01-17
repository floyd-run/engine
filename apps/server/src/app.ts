import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as loggerMiddleware } from "hono/logger";
import { config } from "config";
import { logger } from "lib/logger";

const app = new Hono();

app.use("*", cors());
app.use("*", loggerMiddleware());

app.get("/", (c) => c.json({ name: "Floyd Server", time: new Date() }));

app.onError((err, c) => {
  if (config.NODE_ENV === "production") {
    return c.json({ message: "Internal server error" }, 500);
  } else {
    logger.error(err);
    return c.json([err, err.stack], 500);
  }
});

export default app;
