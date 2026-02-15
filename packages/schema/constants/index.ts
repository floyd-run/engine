export const IdempotencyStatus = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export const WebhookDeliveryStatus = {
  PENDING: "pending",
  IN_FLIGHT: "in_flight",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  EXHAUSTED: "exhausted",
} as const;

export const BookingStatus = {
  HOLD: "hold",
  CONFIRMED: "confirmed",
  CANCELED: "canceled",
  EXPIRED: "expired",
} as const;

export const ScheduleDefault = {
  OPEN: "open",
  CLOSED: "closed",
} as const;
