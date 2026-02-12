# Errors

Floyd Engine uses HTTP status codes to express semantics. Your agent should branch on status codes.

## 404 Not Found

- Resource, service, booking, or allocation ID does not exist.

## 422 Unprocessable Entity

Input didn't match the schema.

Response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": { ... }
  }
}
```

## 409 Conflict (the important one)

`409` means "this request is semantically valid, but cannot be completed".

Common causes:

### Slot not available

Another active allocation already blocks that time range on that resource.

```json
{
  "error": {
    "code": "overlap_conflict",
    "message": "Time slot conflicts with existing allocation"
  }
}
```

### Policy rejected

The service's policy rejects the booking request (wrong hours, invalid duration, etc.).

```json
{
  "error": {
    "code": "policy_rejected",
    "message": "Policy evaluation failed"
  }
}
```

### Resource not in service

The requested resource does not belong to the specified service.

```json
{
  "error": {
    "code": "resource_not_in_service",
    "message": "Resource does not belong to this service"
  }
}
```

### Hold expired

Trying to confirm a booking whose hold has already expired.

```json
{
  "error": {
    "code": "hold_expired",
    "message": "Hold expired"
  }
}
```

### Invalid state transition

Trying to confirm a booking that is not in `hold` state.

```json
{
  "error": {
    "code": "invalid_state_transition",
    "message": "Cannot transition from current status"
  }
}
```

### Active bookings exist

Trying to delete a service that has bookings in `hold` or `confirmed` status.

```json
{
  "error": {
    "code": "active_bookings_exist",
    "message": "Service has active bookings"
  }
}
```

### Policy in use

Trying to delete a policy that is referenced by one or more services.

```json
{
  "error": {
    "code": "policy_in_use",
    "message": "Policy is referenced by one or more services"
  }
}
```

### Booking-owned allocation

Trying to delete an allocation that belongs to a booking. Use the booking cancel endpoint instead.

```json
{
  "error": {
    "code": "booking_owned_allocation",
    "message": "Allocation belongs to a booking"
  }
}
```

### Idempotency mismatch

Same `Idempotency-Key` header but different request body.

```json
{
  "error": {
    "code": "IDEMPOTENCY_MISMATCH",
    "message": "Idempotency key already used with different parameters"
  }
}
```

## 500 Server Error

Unexpected failure. Retry with backoff and the same `Idempotency-Key` header when possible.

## Agent handling pattern (recommended)

- `200`/`201` - proceed
- `409` - pick a new time slot, adjust parameters, or ask the user
- `422` - fix your payload (bug)
- `5xx` - retry with backoff + idempotency
