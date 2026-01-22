import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as loggerMiddleware } from "hono/logger";
import { config } from "config";
import { logger } from "infra/logger";
import { routes } from "routes";
import { ConflictError, InputError, NotFoundError } from "lib/errors";
import { IdempotencyError } from "infra/idempotency";

const app = new Hono();

app.use("*", cors());
app.use("*", loggerMiddleware());

app.route("/", routes);

app.onError((err, c) => {
  if (err instanceof InputError) {
    return c.json({ error: err.message }, 422);
  }

  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404);
  }

  if (err instanceof ConflictError) {
    return c.json({ error: { code: err.reasonCode, details: err.details } }, 409);
  }

  if (err instanceof IdempotencyError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.statusCode);
  }

  if (err.name === "SyntaxError") {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (config.NODE_ENV === "production") {
    return c.json({ message: "Internal server error" }, 500);
  } else {
    logger.error(err);
    return c.json([err, err.stack], 500);
  }
});

export default app;
