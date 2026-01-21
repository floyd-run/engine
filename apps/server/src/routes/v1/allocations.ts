import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeAllocation } from "./serializers";

// Nested under /v1/workspaces/:workspaceId/allocations
export const allocations = new Hono()
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

  .post("/", async (c) => {
    const body = await c.req.json();
    const { allocation } = await services.allocation.create({
      ...body,
      workspaceId: c.req.param("workspaceId"),
    });
    return c.json({ data: serializeAllocation(allocation) }, 201);
  });
