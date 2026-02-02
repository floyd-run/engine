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

## Quick Install

```bash
docker run -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -p 4000:4000 \
  ghcr.io/floyd-run/engine:master
```

See the [Quickstart](./quickstart) for full setup instructions.

## Key ideas

- **Hold**: temporarily reserves a time slot with `expiresAt`
- **Confirm**: commits the hold and clears expiry
- **Idempotency**: retry-safe create requests using `Idempotency-Key` header
- **409 Conflict**: means "the slot is not available" or "idempotency mismatch"

## Where to go next

- [Quickstart](./quickstart) - Get running in 5 minutes
- [Allocations](./allocations) - The booking model
- [Webhooks](./webhooks) - Real-time notifications
- [Idempotency](./idempotency) - Safe retries
- [Errors](./errors) - Error handling
- API Reference (see the sidebar)
