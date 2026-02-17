export const IdempotencyStatus = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
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
