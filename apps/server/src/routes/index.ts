import { Hono } from "hono";
import { v1 } from "./v1/index";

export const routes = new Hono()
  .get("/", (c) => c.json({ name: "Floyd Server", time: new Date() }))
  .route("/v1", v1);
