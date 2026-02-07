import { Hono } from "hono";
import { services } from "../../services/index.js";

// Nested under /v1/ledgers/:ledgerId/availability
export const availability = new Hono().post("/", async (c) => {
  const ledgerId = c.req.param("ledgerId")!;
  const body = await c.req.json();

  const result = await services.availability.query({
    ledgerId,
    resourceIds: body.resourceIds,
    startAt: body.startAt,
    endAt: body.endAt,
  });

  return c.json({ data: result.items });
});
