import type { Context, Next } from "hono";
import { config } from "config";

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Middleware that validates the API key from the Authorization header.
 * Expects: Authorization: Bearer <api_key>
 */
export function auth() {
  return async (c: Context, next: Next) => {
    // Skip auth in development when no API key is configured
    if (!config.FLOYD_API_KEY) {
      await next();
      return;
    }

    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      throw new AuthError("Missing Authorization header", 401, "missing_authorization");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new AuthError(
        "Invalid Authorization header format",
        401,
        "invalid_authorization_format",
      );
    }

    const token = authHeader.slice(7); // Remove "Bearer " prefix

    if (token !== config.FLOYD_API_KEY) {
      throw new AuthError("Invalid API key", 401, "invalid_api_key");
    }

    await next();
  };
}
