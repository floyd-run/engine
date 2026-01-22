import { Context, Next } from "hono";
import { createHash } from "crypto";
import { db } from "database";
import { generateId } from "@floyd-run/utils";

const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
const DEFAULT_TTL_HOURS = 24;

export interface IdempotencyContext {
  key: string;
  workspaceId: string;
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
function computePayloadHash(payload: Record<string, unknown>, significantFields?: string[]): string {
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

    const workspaceId = c.req.param("workspaceId");
    if (!workspaceId) {
      throw new IdempotencyError(
        "Idempotency keys require a workspace context",
        400,
        "idempotency_missing_workspace",
      );
    }

    const path = c.req.path;
    const method = c.req.method;

    // Clone body for hashing (body can only be read once)
    const body = await c.req.json();
    const payloadHash = computePayloadHash(body, significantFields);

    // Store body for later use by handler
    c.set("parsedBody", body);

    // Check for existing key
    const existing = await db
      .selectFrom("idempotencyKeys")
      .selectAll()
      .where("workspaceId", "=", workspaceId)
      .where("key", "=", idempotencyKey)
      .executeTakeFirst();

    if (existing) {
      // Check if expired
      if (existing.expiresAt < new Date()) {
        // Expired - delete and proceed as new request
        await db.deleteFrom("idempotencyKeys").where("id", "=", existing.id).execute();
      } else {
        // Valid existing key - check payload match
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

        // Return cached response
        return c.json(existing.responseBody, existing.responseStatus as 200 | 201);
      }
    }

    // Store context for after handler
    c.set("idempotencyContext", {
      key: idempotencyKey,
      workspaceId,
      path,
      method,
      payloadHash,
      ttlHours,
    });

    await next();
  };
}

/**
 * Call this after successful response to store the idempotency record.
 * Should be called from the route handler after computing the response.
 */
export async function storeIdempotencyResponse(
  c: Context,
  responseBody: Record<string, unknown>,
  responseStatus: number,
): Promise<void> {
  const ctx = c.get("idempotencyContext") as
    | {
        key: string;
        workspaceId: string;
        path: string;
        method: string;
        payloadHash: string;
        ttlHours: number;
      }
    | undefined;

  if (!ctx) {
    return; // No idempotency key was provided
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ctx.ttlHours);

  await db
    .insertInto("idempotencyKeys")
    .values({
      id: generateId("idem"),
      workspaceId: ctx.workspaceId,
      key: ctx.key,
      path: ctx.path,
      method: ctx.method,
      payloadHash: ctx.payloadHash,
      responseStatus,
      responseBody,
      expiresAt,
    })
    .onConflict((oc) =>
      oc.columns(["workspaceId", "key"]).doUpdateSet({
        responseStatus,
        responseBody,
        expiresAt,
      }),
    )
    .execute();
}
