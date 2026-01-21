import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeWorkspace } from "./serializers";

export const workspaces = new Hono()
  .get("/", async (c) => {
    const { workspaces } = await services.workspace.list();
    return c.json({ data: workspaces.map(serializeWorkspace) });
  })

  .get("/:workspaceId", async (c) => {
    const { workspace } = await services.workspace.get({ workspaceId: c.req.param("workspaceId") });
    if (!workspace) throw new NotFoundError("Workspace not found");
    return c.json({ data: serializeWorkspace(workspace) });
  })

  .post("/", async (c) => {
    const body = await c.req.json();
    const { workspace } = await services.workspace.create(body);
    return c.json({ data: serializeWorkspace(workspace) }, 201);
  });
