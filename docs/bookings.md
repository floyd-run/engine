# Bookings

Bookings are policy-evaluated reservations created through a service. They own the lifecycle (hold/confirm/cancel/expire) and manage allocations automatically.

## The problem: non-atomic booking

Many agents do this:

1. Check availability
2. Ask the user to confirm
3. Book the slot

Under latency, two agents can see the same slot as "free" and both try to book it.

## Floyd's lifecycle

A booking moves through these states:

- `hold` — temporary reservation with `expiresAt`. Blocks time.
- `confirmed` — committed reservation. Blocks time.
- `cancelled` — released. Does **not** block time.
- `expired` — expiration time elapsed. Does **not** block time.

### State transitions

| From        | To          | Trigger                                     |
| ----------- | ----------- | ------------------------------------------- |
| (none)      | `hold`      | `POST /bookings`                            |
| (none)      | `confirmed` | `POST /bookings` with `status: "confirmed"` |
| `hold`      | `confirmed` | `POST /bookings/:id/confirm`                |
| `hold`      | `cancelled` | `POST /bookings/:id/cancel`                 |
| `hold`      | `expired`   | `expiresAt` elapsed (automatic)             |
| `confirmed` | `cancelled` | `POST /bookings/:id/cancel`                 |

## Creating a booking

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id" \
  -d '{
    "serviceId": "svc_...",
    "resourceId": "rsc_...",
    "startAt": "2026-03-01T10:00:00Z",
    "endAt": "2026-03-01T11:00:00Z",
    "metadata": { "customerName": "Alice" }
  }'
```

### What happens on create

1. Validates the resource belongs to the service
2. If the service has a policy, evaluates it (working hours, duration, grid, buffers, etc.)
3. If the policy defines buffers, expands the allocation's time window (see [Buffers](#buffers))
4. Checks for time conflicts on the resource
5. Creates a booking with `status=hold` and `expiresAt` (default: 15 minutes from now)
6. Creates an allocation linked to the booking

### Creating as confirmed

Skip the hold step by passing `"status": "confirmed"`:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "svc_...",
    "resourceId": "rsc_...",
    "startAt": "2026-03-01T10:00:00Z",
    "endAt": "2026-03-01T11:00:00Z",
    "status": "confirmed"
  }'
```

This creates the booking without an expiration.

## Confirm (commit)

When the user says "yes", confirm the hold:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/confirm"
```

This:

- Sets `status = confirmed`
- Clears `expiresAt` on both the booking and its allocations

Confirm is safe to retry — confirming an already confirmed booking returns the confirmed booking.

Returns `409 Conflict` with code `hold_expired` if the hold expired before confirmation.

## Cancel (release)

Cancel explicitly releases the slot:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/cancel"
```

This:

- Sets `status = cancelled`
- Deactivates allocations (`active = false`)

Cancel works on both `hold` and `confirmed` bookings. It's safe to retry — cancelling an already cancelled booking returns the booking.

## Expiration

Hold bookings expire automatically when `expiresAt` elapses. The expiration worker:

1. Finds hold bookings where `expiresAt <= now()`
2. Sets `status = expired`
3. Deactivates allocations (`active = false`)
4. Enqueues a `booking.expired` webhook event

After expiration, the time slot is available for new bookings.

## Response format

```json
{
  "data": {
    "id": "bkg_...",
    "ledgerId": "ldg_...",
    "serviceId": "svc_...",
    "status": "hold",
    "expiresAt": "2026-03-01T10:15:00.000Z",
    "allocations": [
      {
        "id": "alc_...",
        "resourceId": "rsc_...",
        "startAt": "2026-03-01T09:45:00.000Z",
        "endAt": "2026-03-01T11:10:00.000Z",
        "bufferBeforeMs": 900000,
        "bufferAfterMs": 600000,
        "active": true
      }
    ],
    "metadata": { "customerName": "Alice" },
    "createdAt": "2026-03-01T09:45:00.000Z",
    "updatedAt": "2026-03-01T09:45:00.000Z"
  },
  "meta": {
    "serverTime": "2026-03-01T09:45:00.000Z"
  }
}
```

Mutating endpoints (`create`, `confirm`, `cancel`) return `meta.serverTime`.

## Buffers

When a service's policy defines buffers (`before_ms` / `after_ms`), the allocation's `startAt` and `endAt` are expanded to include the buffer time. This is the actual blocked window on the resource.

For example, a booking at 10:00–11:00 with a 15-minute before-buffer and 10-minute after-buffer creates an allocation blocking 09:45–11:10.

The allocation includes `bufferBeforeMs` and `bufferAfterMs` so the original customer time is derivable:

- Customer start = `allocation.startAt` + `bufferBeforeMs`
- Customer end = `allocation.endAt` - `bufferAfterMs`

When no policy or no buffers are configured, both values are `0` and the allocation times match the requested times exactly.

Conflict detection uses the buffer-expanded times, so adjacent customer appointments that would overlap in buffer time are correctly rejected.

## History

Cancelled and expired bookings retain their allocations with `active: false`. This preserves the full record of what was booked — which resource, which time range — even after the booking is no longer blocking time.

This is useful for AI agents that need context to make decisions (e.g., "the customer cancelled their 3pm — rebook at 4pm").

## The "physics" (what you can rely on)

For a single resource:

- If two requests try to book overlapping time ranges at the same moment, **exactly one** will succeed — the rest will get **409 Conflict**
- This remains true under heavy concurrency

## Time overlap semantics

Floyd uses **half-open intervals**: **[startAt, endAt)**

- Back-to-back bookings are allowed: `[10:00, 10:30)` and `[10:30, 11:00)` do not overlap
