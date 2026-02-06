import { Hono } from "hono";
import { allocations } from "./allocations";
import { availability } from "./availability";
import { resources } from "./resources";
import { ledgers } from "./ledgers";
import { webhooks } from "./webhooks";

export const v1 = new Hono()
  .route("/ledgers", ledgers)
  .route("/ledgers/:ledgerId/resources", resources)
  .route("/ledgers/:ledgerId/allocations", allocations)
  .route("/ledgers/:ledgerId/availability", availability)
  .route("/ledgers/:ledgerId/webhooks", webhooks);
