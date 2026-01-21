import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeResource } from "./serializers";

// Nested under /v1/workspaces/:workspaceId/resources
export const resources = new Hono()
  .get("/", async (c) => {
    const workspaceId = c.req.param("workspaceId");
    const { resources } = await services.resource.list({ workspaceId });
    return c.json({ data: resources.map(serializeResource) });
  })

  .get("/:id", async (c) => {
    const { resource } = await services.resource.get({ id: c.req.param("id") });
    if (!resource) throw new NotFoundError("Resource not found");
    return c.json({ data: serializeResource(resource) });
  })

  .post("/", async (c) => {
    const workspaceId = c.req.param("workspaceId");
    const body = await c.req.json();
    const { resource } = await services.resource.create({ ...body, workspaceId });
    return c.json({ data: serializeResource(resource) }, 201);
  })

  .delete("/:id", async (c) => {
    await services.resource.remove({ id: c.req.param("id") });
    return c.body(null, 204);
  });
