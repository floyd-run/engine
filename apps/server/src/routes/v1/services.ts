import { Hono } from "hono";
import { operations } from "operations";
import { NotFoundError } from "lib/errors";
import { serializeService } from "./serializers";

// Nested under /v1/ledgers/:ledgerId/services
export const services = new Hono()
  .get("/", async (c) => {
    const { services } = await operations.service.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({
      data: services.map(({ service, resourceIds }) => serializeService(service, resourceIds)),
    });
  })

  .get("/:id", async (c) => {
    const { service, resourceIds } = await operations.service.get({ id: c.req.param("id") });
    if (!service) throw new NotFoundError("Service not found");
    return c.json({ data: serializeService(service, resourceIds) });
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const { service, resourceIds } = await operations.service.create({
      ...body,
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: serializeService(service, resourceIds) }, 201);
  })

  .put("/:id", async (c) => {
    const body = await c.req.json();
    const { service, resourceIds } = await operations.service.update({
      ...body,
      id: c.req.param("id"),
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: serializeService(service, resourceIds) });
  })

  .delete("/:id", async (c) => {
    await operations.service.remove({ id: c.req.param("id") });
    return c.body(null, 204);
  });
