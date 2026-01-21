import { Hono } from "hono";
import { allocations } from "./allocations";
import { resources } from "./resources";
import { workspaces } from "./workspaces";

export const v1 = new Hono()
  .route("/workspaces", workspaces)
  .route("/workspaces/:workspaceId/resources", resources)
  .route("/workspaces/:workspaceId/allocations", allocations);
