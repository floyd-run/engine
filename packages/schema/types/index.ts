import type { z } from "zod";
import type * as outputs from "../outputs";
import {
  AllocationStatus,
  IdempotencyStatus,
  WebhookDeliveryStatus,
  PolicyDefault,
} from "../constants";
import { ConstantType } from "./utils";

export type AllocationStatus = ConstantType<typeof AllocationStatus>;
export type IdempotencyStatus = ConstantType<typeof IdempotencyStatus>;
export type WebhookDeliveryStatus = ConstantType<typeof WebhookDeliveryStatus>;
export type PolicyDefault = ConstantType<typeof PolicyDefault>;

export type Allocation = z.infer<typeof outputs.allocation.schema>;
export type Resource = z.infer<typeof outputs.resource.schema>;
export type Ledger = z.infer<typeof outputs.ledger.schema>;
export type AvailabilityItem = z.infer<typeof outputs.availability.itemSchema>;
export type TimelineBlock = z.infer<typeof outputs.availability.timelineBlockSchema>;
export type Policy = z.infer<typeof outputs.policy.schema>;
