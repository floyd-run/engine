import type { z } from "zod";
import type * as outputs from "../outputs";
import { AllocationStatus, IdempotencyStatus, WebhookDeliveryStatus } from "../constants";
import { ConstantType } from "./utils";

export type AllocationStatus = ConstantType<typeof AllocationStatus>;
export type IdempotencyStatus = ConstantType<typeof IdempotencyStatus>;
export type WebhookDeliveryStatus = ConstantType<typeof WebhookDeliveryStatus>;

export type Allocation = z.infer<typeof outputs.allocation.schema>;
export type Resource = z.infer<typeof outputs.resource.schema>;
export type Ledger = z.infer<typeof outputs.ledger.schema>;
