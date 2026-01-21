import { Hono } from "hono";
import { resource } from "./resources";
import { workspaces } from "./workspaces";

export const v1 = new Hono()
  .route("/resources", resource)
  .route("/workspaces", workspaces);
