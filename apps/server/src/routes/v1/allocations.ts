import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { idempotent, storeIdempotencyResponse, IdempotencyVariables } from "infra/idempotency";
import { serializeAllocation } from "./serializers";

// Significant fields for allocation create idempotency hash
const ALLOCATION_SIGNIFICANT_FIELDS = ["resourceId", "startAt", "endAt", "status", "expiresAt"];

// Nested under /v1/workspaces/:workspaceId/allocations
export const allocations = new Hono<{ Variables: IdempotencyVariables }>()
  .get("/", async (c) => {
    const { allocations } = await services.allocation.list({
      workspaceId: c.req.param("workspaceId")!,
    });
    return c.json({ data: allocations.map(serializeAllocation) });
  })

  .get("/:id", async (c) => {
    const { allocation } = await services.allocation.get({ id: c.req.param("id") });
    if (!allocation) throw new NotFoundError("Allocation not found");
    return c.json({ data: serializeAllocation(allocation) });
  })

  .post("/", idempotent({ significantFields: ALLOCATION_SIGNIFICANT_FIELDS }), async (c) => {
    const body = c.get("parsedBody") || (await c.req.json());
    const { allocation, serverTime } = await services.allocation.create({
      ...body,
      workspaceId: c.req.param("workspaceId"),
    });
    const responseBody = { data: serializeAllocation(allocation), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 201);
    return c.json(responseBody, 201);
  })

  .post("/:id/confirm", idempotent(), async (c) => {
    const { allocation, serverTime } = await services.allocation.confirm({
      id: c.req.param("id"),
    });
    const responseBody = { data: serializeAllocation(allocation), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 200);
    return c.json(responseBody);
  })

  .post("/:id/cancel", idempotent(), async (c) => {
    const { allocation, serverTime } = await services.allocation.cancel({
      id: c.req.param("id"),
    });
    const responseBody = { data: serializeAllocation(allocation), meta: { serverTime } };
    await storeIdempotencyResponse(c, responseBody, 200);
    return c.json(responseBody);
  });
