import { Hono } from "hono";
import { services } from "../../services/index.js";
import { NotFoundError } from "lib/errors";
import { serializeWorkspace } from "./serializers";

export const workspaces = new Hono()
  .get("/", async (c) => {
    const { workspaces } = await services.workspace.list();
    return c.json({ data: workspaces.map(serializeWorkspace) });
  })

  .get("/:id", async (c) => {
    const { workspace } = await services.workspace.get({ id: c.req.param("id") });
    if (!workspace) throw new NotFoundError("Workspace not found");
    return c.json({ data: serializeWorkspace(workspace) });
  })

  .post("/", async (c) => {
    const { workspace } = await services.workspace.create();
    return c.json({ data: serializeWorkspace(workspace) }, 201);
  });
