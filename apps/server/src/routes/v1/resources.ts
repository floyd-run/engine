import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeResource } from "./serializers";

// Nested under /v1/ledgers/:ledgerId/resources
export const resources = new Hono()
  .get("/", async (c) => {
    const { resources } = await services.resource.list({
      ledgerId: c.req.param("ledgerId")!,
    });
    return c.json({ data: resources.map(serializeResource) });
  })

  .get("/:id", async (c) => {
    const { resource } = await services.resource.get({ id: c.req.param("id") });
    if (!resource) throw new NotFoundError("Resource not found");
    return c.json({ data: serializeResource(resource) });
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const { resource } = await services.resource.create({
      ...body,
      ledgerId: c.req.param("ledgerId"),
    });
    return c.json({ data: serializeResource(resource) }, 201);
  })

  .delete("/:id", async (c) => {
    await services.resource.remove({ id: c.req.param("id") });
    return c.body(null, 204);
  });
