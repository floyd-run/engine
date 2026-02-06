import { Hono } from "hono";
import { services } from "../../services/index.js";

// Nested under /v1/ledgers/:ledgerId/availability
export const availability = new Hono().get("/", async (c) => {
  const ledgerId = c.req.param("ledgerId")!;
  const resourceIds = c.req.queries("resourceIds") || [];
  const startAt = c.req.query("startAt")!;
  const endAt = c.req.query("endAt")!;

  const result = await services.availability.query({
    ledgerId,
    resourceIds,
    startAt,
    endAt,
  });

  return c.json({ data: result.items });
});
