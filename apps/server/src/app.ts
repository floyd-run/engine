import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as loggerMiddleware } from "hono/logger";
import { config } from "config";
import { logger } from "infra/logger";
import { routes } from "routes";
import { ConflictError, InputError, NotFoundError } from "lib/errors";
import { IdempotencyError } from "infra/idempotency";
import { auth, AuthError } from "infra/auth";

const app = new Hono();

app.use("*", cors());
app.use("*", loggerMiddleware());
app.use("/v1/*", auth());

app.route("/", routes);

app.onError((err, c) => {
  if (err instanceof InputError) {
    return c.json(
      { error: { code: "invalid_input", message: err.message, issues: err.issues } },
      422,
    );
  }

  if (err instanceof NotFoundError) {
    const details: Record<string, string> = {};
    if (err["resourceType"]) details["resourceType"] = err["resourceType"];
    if (err["resourceId"]) details["resourceId"] = err["resourceId"];
    return c.json(
      {
        error: {
          code: "not_found",
          message: err.message,
          ...(Object.keys(details).length > 0 ? { details } : {}),
        },
      },
      404,
    );
  }

  if (err instanceof ConflictError) {
    return c.json(
      {
        error: {
          code: err.reasonCode,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      409,
    );
  }

  if (err instanceof IdempotencyError) {
    return c.json({ error: { code: err.code, message: err.message } }, err.statusCode as 400 | 422);
  }

  if (err instanceof AuthError) {
    return c.json({ error: { code: err.code, message: err.message } }, 401);
  }

  if (err.name === "SyntaxError") {
    return c.json({ error: { code: "invalid_json", message: "Invalid JSON" } }, 400);
  }

  logger.error(err);

  if (config.NODE_ENV === "production") {
    return c.json({ error: { code: "internal_error", message: "Internal server error" } }, 500);
  } else {
    return c.json([err, err.stack], 500);
  }
});

export default app;
