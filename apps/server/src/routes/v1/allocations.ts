import { Hono } from "hono";
import { operations } from "operations";
import { NotFoundError } from "lib/errors";
import { idempotent, storeIdempotencyResponse, type IdempotencyVariables } from "infra/idempotency";
import { serializeAllocation } from "./serializers";

// Significant fields for allocation create idempotency hash
const ALLOCATION_SIGNIFICANT_FIELDS = ["resourceId", "startTime", "endTime", "expiresAt"];

// Nested under /v1/ledgers/:ledgerId/allocations
export const allocations = new Hono<{ Variables: IdempotencyVariables }>()
  .get("/", async (c) => {
    const { allocations } = await operations.allocation.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: allocations.map(serializeAllocation) });
  })

  .get("/:id", async (c) => {
    const { allocation } = await operations.allocation.get({
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
    });
    if (!allocation) throw new NotFoundError("Allocation not found");
    return c.json({ data: serializeAllocation(allocation) });
  })

  .post("/", idempotent({ significantFields: ALLOCATION_SIGNIFICANT_FIELDS }), async (c) => {
    const body = c.get("parsedBody") ?? (await c.req.json());
    const { allocation, serverTime } = await operations.allocation.create({
      ...(body as object),
      ledgerId: c.req.param("ledgerId"),
    } as Parameters<typeof operations.allocation.create>[0]);
    const responseBody = { data: serializeAllocation(allocation), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 201);
    return c.json(responseBody, 201);
  })

  .delete("/:id", async (c) => {
    await operations.allocation.remove({
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.body(null, 204);
  });
