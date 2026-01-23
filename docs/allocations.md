# Allocations

Floyd Engine's core promise:

> **Double-booking is impossible**, even under concurrency and retries.

Floyd achieves this with a **two-phase booking lifecycle**.

## The problem: non-atomic booking

Many agents do this:

1. Check availability
2. Ask the user to confirm
3. Book the slot

Under latency, two agents can see the same slot as "free" and both try to book it.

## Floyd's lifecycle

An allocation moves through these states:

- `hold` — temporary reservation with `expiresAt` set. Blocks time.
- `confirmed` — committed allocation. Blocks time.
- `cancelled` — released. Does **not** block time.
- `expired` — expiration time elapsed. Does **not** block time.

### State transitions

| From        | To          | Trigger                         |
| ----------- | ----------- | ------------------------------- |
| (none)      | `hold`      | `POST /allocations`             |
| `hold`      | `confirmed` | `POST /allocations/:id/confirm` |
| `hold`      | `cancelled` | `POST /allocations/:id/cancel`  |
| `hold`      | `expired`   | `expiresAt` elapsed (automatic) |
| `confirmed` | `cancelled` | `POST /allocations/:id/cancel`  |

## Holds

When you create an allocation, it starts as `hold` by default.

- It **blocks the time slot** immediately.
- It has an optional `expiresAt` timestamp.
- The expiration window is your agent's "ask the user" time.

If not confirmed, the hold expires and the slot becomes available again.

### Lazy cleanup

Floyd automatically marks expired holds as `expired` when you create a new allocation on the same resource. This "lazy cleanup" ensures expired holds don't block slots indefinitely, while avoiding background jobs.

## Confirm (commit)

When the user says "yes", call:

- `POST /v1/workspaces/:workspaceId/allocations/:id/confirm`

This:

- sets `status = confirmed`
- clears `expiresAt`

Confirm is safe to retry:

- confirming an already confirmed allocation returns the confirmed allocation

## Cancel (release)

Cancel explicitly releases the slot:

- `POST /v1/workspaces/:workspaceId/allocations/:id/cancel`

Cancel is safe to retry:

- cancelling an already cancelled/expired allocation returns the allocation
- cancelling a `confirmed` allocation also works and releases the slot

## Time overlap semantics

Floyd uses **half-open intervals**: **[startAt, endAt)**

That means:

- back-to-back allocations are allowed
  e.g. `[10:00, 10:30)` and `[10:30, 11:00)` do not overlap

Overlap exists iff:

- `allocation.startAt < query.endAt` **and**
- `allocation.endAt > query.startAt`

## The "physics" (what you can rely on)

For a single `resourceId`:

- If two requests try to hold overlapping time ranges at the same moment:
  - **exactly one** will succeed
  - the rest will get **409 Conflict**

This remains true under heavy concurrency.
