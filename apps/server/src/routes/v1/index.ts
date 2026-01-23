import { Hono } from "hono";
import { allocations } from "./allocations";
import { resources } from "./resources";
import { ledgers } from "./ledgers";

export const v1 = new Hono()
  .route("/ledgers", ledgers)
  .route("/ledgers/:ledgerId/resources", resources)
  .route("/ledgers/:ledgerId/allocations", allocations);
