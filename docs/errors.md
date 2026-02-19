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
    "code": "invalid_input",
    "message": "Invalid input",
    "issues": [...]
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
    "code": "allocation.overlap",
    "message": "Conflict",
    "details": {
      "conflictingAllocationIds": ["alc_..."]
    }
  }
}
```

### Policy rejected

The service's policy rejects the booking request (wrong hours, invalid duration, etc.). The top-level code is always `policy.rejected`; the specific reason is in `details.code`.

```json
{
  "error": {
    "code": "policy.rejected",
    "message": "Conflict",
    "details": {
      "code": "policy.blackout",
      "message": "Blackout window"
    }
  }
}
```

Policy sub-codes:

| `details.code`                   | Meaning                                     |
| -------------------------------- | ------------------------------------------- |
| `policy.blackout`                | Date falls in a blackout window             |
| `policy.closed`                  | Service is closed at that time              |
| `policy.invalid_duration`        | Duration not allowed by policy              |
| `policy.misaligned_start`        | Start time doesn't align to scheduling grid |
| `policy.lead_time_violation`     | Too short notice                            |
| `policy.horizon_exceeded`        | Too far in advance                          |
| `policy.overnight_not_supported` | Overnight bookings not supported            |

### Resource not in service

The requested resource does not belong to the specified service.

```json
{
  "error": {
    "code": "service.resource_not_member",
    "message": "Conflict",
    "details": {
      "serviceId": "svc_...",
      "resourceId": "rsc_..."
    }
  }
}
```

### Service has no policy

Trying to create a booking against a service that has no policy attached.

```json
{
  "error": {
    "code": "service.no_policy",
    "message": "Conflict"
  }
}
```

### Hold expired

Trying to confirm a booking whose hold has already expired.

```json
{
  "error": {
    "code": "booking.hold_expired",
    "message": "Conflict",
    "details": {
      "expiresAt": "2026-03-01T10:15:00.000Z",
      "serverTime": "2026-03-01T10:20:00.000Z"
    }
  }
}
```

### Invalid state transition

Trying to confirm or cancel a booking that is not in the expected state.

```json
{
  "error": {
    "code": "booking.invalid_transition",
    "message": "Conflict",
    "details": {
      "currentStatus": "confirmed",
      "requestedStatus": "confirmed"
    }
  }
}
```

### Active bookings exist

Trying to delete a service that has bookings in `hold` or `confirmed` status.

```json
{
  "error": {
    "code": "service.active_bookings",
    "message": "Conflict"
  }
}
```

### Resource in use

Trying to delete a resource that has allocations or service associations.

```json
{
  "error": {
    "code": "resource.in_use",
    "message": "Conflict",
    "details": {
      "message": "Resource has active allocations or service associations"
    }
  }
}
```

### Policy in use

Trying to delete a policy that is referenced by one or more services or bookings.

```json
{
  "error": {
    "code": "policy.in_use",
    "message": "Conflict",
    "details": {
      "message": "Policy is referenced by one or more services or bookings"
    }
  }
}
```

### Booking-owned allocation

Trying to delete an allocation that belongs to a booking. Use the booking cancel endpoint instead.

```json
{
  "error": {
    "code": "allocation.managed_by_booking",
    "message": "Conflict",
    "details": {
      "bookingId": "bkg_..."
    }
  }
}
```

### Idempotency mismatch

Same `Idempotency-Key` header but different request body or path.

```json
{
  "error": {
    "code": "idempotency_payload_mismatch",
    "message": "Idempotency key already used with different payload"
  }
}
```

## 425 Too Early

A previous request with the same `Idempotency-Key` is still processing. Wait and retry.

```json
{
  "error": {
    "code": "idempotency_in_progress",
    "message": "Previous request still in progress"
  }
}
```

## 500 Server Error

Unexpected failure. Retry with backoff and the same `Idempotency-Key` header when possible.

## Agent handling pattern (recommended)

- `200`/`201` - proceed
- `409` - pick a new time slot, adjust parameters, or ask the user
- `422` - fix your payload (bug)
- `425` - wait and retry with the same `Idempotency-Key`
- `5xx` - retry with backoff + idempotency
