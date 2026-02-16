# Floyd Engine

> **Dev Preview** - Floyd Engine is in active development. APIs may change. Not recommended for production use yet.

Floyd Engine is a booking engine for AI agents.

It helps agent workflows safely book time slots under real-world conditions like:

- latency between "check availability" and "book"
- retries/timeouts
- high concurrency

Floyd's core flow is a **two-phase booking**:

1. **Create a hold** on a service — reserves the slot with an expiration
2. **Confirm** when the user says "yes"

This makes double-booking **impossible by construction**, because overlap rules are enforced at the database layer.

## Quick Install

```bash
docker run -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -p 4000:4000 \
  ghcr.io/floyd-run/engine:master
```

See the [Quickstart](./quickstart) for full setup instructions.

## Key ideas

- **Service**: groups resources with a policy (e.g., "Yoga Class" using Room A with weekday-hours rules)
- **Booking**: a policy-evaluated reservation with lifecycle (hold → confirm → cancel/expire)
- **Allocation**: a time block on a resource. Bookings create allocations automatically; raw allocations exist for ad-hoc blocking.
- **Policy**: scheduling rules (working hours, duration limits, grid alignment, buffers)
- **Idempotency**: retry-safe requests using `Idempotency-Key` header
- **409 Conflict**: means "the slot is not available", "policy rejected", or "idempotency mismatch"

## Where to go next

- [Quickstart](./quickstart) - Get running in 5 minutes
- [Services](./services) - Grouping resources with policies
- [Bookings](./bookings) - The reservation lifecycle
- [Allocations](./allocations) - Raw time blocks
- [Policies](./policies) - Scheduling rules
- [Availability](./availability) - Slots, windows, and free/busy timelines
- [Events](./events) - Event system and consumption
- [Idempotency](./idempotency) - Safe retries
- [Errors](./errors) - Error handling
