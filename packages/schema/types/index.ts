import type { z } from "zod";
import type * as outputs from "../outputs";
import { BookingStatus, IdempotencyStatus, ScheduleDefault } from "../constants";
import { ConstantType } from "./utils";

export type BookingStatus = ConstantType<typeof BookingStatus>;
export type IdempotencyStatus = ConstantType<typeof IdempotencyStatus>;
export type ScheduleDefault = ConstantType<typeof ScheduleDefault>;

export type Allocation = z.infer<typeof outputs.allocation.base>;
export type Resource = z.infer<typeof outputs.resource.base>;
export type Ledger = z.infer<typeof outputs.ledger.base>;
export type AvailabilityItem = z.infer<typeof outputs.availability.item>;
export type TimelineBlock = z.infer<typeof outputs.availability.timelineBlock>;
export type Policy = z.infer<typeof outputs.policy.base>;
export type Service = z.infer<typeof outputs.service.base>;
export type Booking = z.infer<typeof outputs.booking.base>;
