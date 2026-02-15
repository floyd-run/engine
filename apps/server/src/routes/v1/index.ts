import { Hono } from "hono";
import { allocations } from "./allocations";
import { availability } from "./availability";
import { resources } from "./resources";
import { ledgers } from "./ledgers";
import { webhooks } from "./webhooks";
import { policies } from "./policies";
import { services } from "./services";
import { bookings } from "./bookings";

export const v1 = new Hono()
  .route("/ledgers", ledgers)
  .route("/ledgers/:ledgerId/resources", resources)
  .route("/ledgers/:ledgerId/allocations", allocations)
  .route("/ledgers/:ledgerId/availability", availability)
  .route("/ledgers/:ledgerId/webhooks", webhooks)
  .route("/ledgers/:ledgerId/policies", policies)
  .route("/ledgers/:ledgerId/services", services)
  .route("/ledgers/:ledgerId/bookings", bookings);
