# Floyd Engine

Floyd Engine is a transaction layer for scheduling.

It helps agent workflows safely book time slots under real-world conditions like:

- latency between "check availability" and "book"
- retries/timeouts
- high concurrency

Floyd's core primitive is a **two-phase booking**:

1. **Create a hold** (`hold`) with an expiration time
2. **Confirm** it (`confirmed`) when the user says "yes"

This makes double-booking **impossible by construction**, because overlap rules are enforced at the database layer.

## Key ideas

- **Hold**: temporarily reserves a time slot with `expiresAt`
- **Confirm**: commits the hold and clears expiry
- **Idempotency**: retry-safe create requests using `Idempotency-Key` header
- **409 Conflict**: means "the slot is not available" or "idempotency mismatch"

## Where to go next

- [Quickstart](./quickstart)
- [Allocations](./allocations)
- [Idempotency](./idempotency)
- [Errors](./errors)
- API Reference (see the "API Reference" section in the sidebar)
