# Errors

Floyd Engine uses HTTP status codes to express semantics. Your agent should branch on status codes.

## 404 Not Found

- Allocation ID does not exist (or is not accessible).

## 400 Bad Request (input validation)

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

Another allocation already blocks that time range on that resource.

```json
{
  "error": {
    "code": "ALLOCATION_CONFLICT",
    "message": "Time slot conflicts with existing allocation"
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

### Hold expired

Trying to confirm an allocation that has already expired.

```json
{
  "error": {
    "code": "HOLD_EXPIRED",
    "message": "Hold expired"
  }
}
```

### Invalid state transition

Trying to confirm an allocation that is not in `hold` state.

```json
{
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "Cannot confirm allocation with status: cancelled"
  }
}
```

## 500 Server Error

Unexpected failure. Retry with backoff and the same `Idempotency-Key` header when possible.

## Agent handling pattern (recommended)

- `200`/`201` → proceed
- `409` → pick a new time slot or ask the user
- `400` → fix your payload (bug)
- `5xx` → retry with backoff + idempotency
