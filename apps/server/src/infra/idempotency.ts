import { Context, Next } from "hono";
import { createHash } from "crypto";
import { db } from "database";

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyContext {
  key: string;
  ledgerId: string;
  path: string;
  method: string;
  payloadHash: string;
  ttlHours: number;
}

export interface IdempotencyVariables {
  parsedBody?: Record<string, unknown>;
  idempotencyContext?: IdempotencyContext;
}

export class IdempotencyError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "IdempotencyError";
  }
}

interface IdempotencyOptions {
  /** Fields to include in payload hash. If not provided, hashes entire payload */
  significantFields?: string[];
  /** TTL in hours for stored keys. Defaults to 24 */
  ttlHours?: number;
}

/**
 * Computes a SHA-256 hash of the significant payload fields
 */
function computePayloadHash(
  payload: Record<string, unknown>,
  significantFields?: string[],
): string {
  let dataToHash: Record<string, unknown>;

  if (significantFields && significantFields.length > 0) {
    dataToHash = {};
    for (const field of significantFields) {
      if (field in payload) {
        dataToHash[field] = payload[field];
      }
    }
  } else {
    dataToHash = payload;
  }

  // Sort keys for deterministic hashing
  const sortedJson = JSON.stringify(dataToHash, Object.keys(dataToHash).sort());
  return createHash("sha256").update(sortedJson).digest("hex");
}

/**
 * Middleware factory for idempotent POST requests.
 *
 * Uses insert-first pattern to handle concurrent requests safely:
 * 1. Try to INSERT with status='in_progress' - the unique constraint serializes races
 * 2. If insert succeeds, proceed with handler
 * 3. If insert fails (conflict), check existing record:
 *    - If 'completed': return cached response (or error if payload mismatch)
 *    - If 'in_progress': return 425 Too Early
 *
 * Usage:
 * ```ts
 * app.post("/allocations", idempotent({ significantFields: ["resourceId", "startAt", "endAt", "status"] }), handler)
 * ```
 */
export function idempotent(options: IdempotencyOptions = {}) {
  const { significantFields, ttlHours = DEFAULT_TTL_HOURS } = options;

  return async (c: Context, next: Next) => {
    const idempotencyKey = c.req.header(IDEMPOTENCY_KEY_HEADER);

    // No idempotency key - proceed normally
    if (!idempotencyKey) {
      return next();
    }

    const ledgerId = c.req.param("ledgerId");
    if (!ledgerId) {
      throw new IdempotencyError(
        "Idempotency keys require a ledger context",
        400,
        "idempotency_missing_ledger",
      );
    }

    const path = c.req.path;
    const method = c.req.method;

    // Clone body for hashing (body can only be read once)
    const body = await c.req.json();
    const payloadHash = computePayloadHash(body, significantFields);

    // Store body for later use by handler
    c.set("parsedBody", body);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttlHours);

    // Try to insert with in_progress status first
    // The unique constraint on (ledger_id, key) serializes concurrent requests
    try {
      await db
        .insertInto("idempotencyKeys")
        .values({
          ledgerId,
          key: idempotencyKey,
          path,
          method,
          payloadHash,
          status: "in_progress",
          responseStatus: null,
          responseBody: null,
          expiresAt,
        })
        .execute();

      // Insert succeeded - we own this key, proceed with handler
      c.set("idempotencyContext", {
        key: idempotencyKey,
        ledgerId,
        path,
        method,
        payloadHash,
        ttlHours,
      });

      try {
        await next();
      } catch (handlerError: unknown) {
        // Handler failed — clean up the in_progress record so client can retry
        await db
          .deleteFrom("idempotencyKeys")
          .where("ledgerId", "=", ledgerId)
          .where("key", "=", idempotencyKey)
          .where("status", "=", "in_progress")
          .execute();
        throw handlerError;
      }
    } catch (error: unknown) {
      // Check if it's a unique constraint violation (PG error code 23505)
      const isConflict =
        error instanceof Error &&
        "code" in error &&
        (error as Error & { code: string }).code === "23505";

      if (!isConflict) {
        throw error;
      }

      // Conflict - another request has this key, check its status
      const existing = await db
        .selectFrom("idempotencyKeys")
        .selectAll()
        .where("ledgerId", "=", ledgerId)
        .where("key", "=", idempotencyKey)
        .executeTakeFirst();

      if (!existing) {
        // Race condition: key was deleted between our insert attempt and select
        // This shouldn't happen in normal operation, retry would be appropriate
        throw new IdempotencyError(
          "Idempotency key conflict, please retry",
          409,
          "idempotency_conflict",
        );
      }

      // Check if expired
      if (existing.expiresAt < new Date()) {
        // Expired - delete and retry (caller should retry the request)
        await db
          .deleteFrom("idempotencyKeys")
          .where("ledgerId", "=", ledgerId)
          .where("key", "=", idempotencyKey)
          .execute();

        throw new IdempotencyError(
          "Idempotency key expired, please retry with the same key",
          409,
          "idempotency_expired",
        );
      }

      // Check payload match
      if (existing.payloadHash !== payloadHash) {
        throw new IdempotencyError(
          "Idempotency key already used with different payload",
          422,
          "idempotency_payload_mismatch",
        );
      }

      // Path and method must also match
      if (existing.path !== path || existing.method !== method) {
        throw new IdempotencyError(
          "Idempotency key already used with different request",
          422,
          "idempotency_request_mismatch",
        );
      }

      // Check status
      if (existing.status === "in_progress") {
        // Another request is still processing
        throw new IdempotencyError(
          "Request with this idempotency key is still being processed",
          425,
          "idempotency_in_progress",
        );
      }

      // Status is 'completed' - return cached response
      if (existing.responseStatus !== null && existing.responseBody !== null) {
        return c.json(existing.responseBody, existing.responseStatus as 200 | 201);
      }

      // Completed but no response (shouldn't happen, but handle gracefully)
      throw new IdempotencyError(
        "Idempotency key in invalid state",
        500,
        "idempotency_invalid_state",
      );
    }
  };
}

/**
 * Call this after successful response to mark the idempotency record as completed.
 * Should be called from the route handler after computing the response.
 */
export async function storeIdempotencyResponse(
  c: Context,
  responseBody: Record<string, unknown>,
  responseStatus: number,
): Promise<void> {
  const ctx = c.get("idempotencyContext") as IdempotencyContext | undefined;

  if (!ctx) {
    return; // No idempotency key was provided
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ctx.ttlHours);

  // Update the in_progress record to completed with the response
  await db
    .updateTable("idempotencyKeys")
    .set({
      status: "completed",
      responseStatus,
      responseBody,
      expiresAt,
    })
    .where("ledgerId", "=", ctx.ledgerId)
    .where("key", "=", ctx.key)
    .execute();
}
