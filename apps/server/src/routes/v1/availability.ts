/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Hono } from "hono";
import { operations } from "operations";

// Nested under /v1/ledgers/:ledgerId/availability
export const availability = new Hono().post("/", async (c) => {
  const ledgerId = c.req.param("ledgerId")!;
  const body = await c.req.json();

  const result = await operations.availability.query({
    ledgerId,
    resourceIds: body.resourceIds,
    startTime: body.startTime,
    endTime: body.endTime,
  });

  return c.json({ data: result.items });
});
