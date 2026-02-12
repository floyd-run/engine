# Allocations

Allocations are time blocks on resources. They are the single source of truth for "is this time taken?"

There are two types:

1. **Booking allocations** — created and managed automatically by bookings. You don't interact with these directly.
2. **Raw allocations** — created and deleted directly via the API, for ad-hoc time blocking.

## Raw allocations

Raw allocations exist for use cases that don't go through the booking flow:

- Maintenance windows
- External calendar blocks (Google Calendar sync, etc.)
- Manual time blocking

### Create a raw allocation

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id" \
  -d '{
    "resourceId": "rsc_01abc123...",
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T11:00:00Z",
    "metadata": { "reason": "maintenance" }
  }'
```

Response:

```json
{
  "data": {
    "id": "alc_01abc123...",
    "ledgerId": "ldg_01xyz789...",
    "resourceId": "rsc_01abc123...",
    "bookingId": null,
    "active": true,
    "startAt": "2026-01-04T10:00:00.000Z",
    "endAt": "2026-01-04T11:00:00.000Z",
    "bufferBeforeMs": 0,
    "bufferAfterMs": 0,
    "expiresAt": null,
    "metadata": { "reason": "maintenance" },
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  },
  "meta": {
    "serverTime": "2026-01-04T10:00:00.000Z"
  }
}
```

Raw allocations have no status lifecycle — they are `active: true` when created and block time immediately. No policy evaluation is performed.

### Temporary blocks

Use `expiresAt` for blocks that should auto-expire:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "rsc_...",
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T11:00:00Z",
    "expiresAt": "2026-01-04T10:30:00Z"
  }'
```

Expired raw allocations are cleaned up automatically by the expiration worker (hard-deleted, since they have no booking to preserve).

### Delete a raw allocation

```bash
curl -X DELETE "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations/$ALLOCATION_ID"
```

- Returns `204 No Content` on success
- Returns `409 Conflict` with code `booking_owned_allocation` if the allocation belongs to a booking — use the booking cancel endpoint instead

### Get an allocation

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations/$ALLOCATION_ID"
```

### List allocations

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations"
```

Returns all allocations for the ledger, including both raw and booking-owned.

## Conflict detection

Both bookings and raw allocations share the same conflict detection. Only `active` and non-expired allocations block time:

- `active = true` and `expiresAt` is null → always blocks
- `active = true` and `expiresAt > now()` → blocks until expiry
- `active = false` → does not block (cancelled/expired booking allocations)
- `active = true` and `expiresAt <= now()` → does not block (expired)

If two requests try to create overlapping allocations on the same resource at the same moment, **exactly one** will succeed.

## Time overlap semantics

Floyd uses **half-open intervals**: **[startAt, endAt)**

- Back-to-back allocations are allowed: `[10:00, 10:30)` and `[10:30, 11:00)` do not overlap

Overlap exists iff:

- `allocation.startAt < query.endAt` **and**
- `allocation.endAt > query.startAt`

## Allocation fields

| Field            | Type    | Description                                                                                          |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `id`             | string  | Allocation ID (`alc_` prefix)                                                                        |
| `ledgerId`       | string  | Ledger this allocation belongs to                                                                    |
| `resourceId`     | string  | Resource being blocked                                                                               |
| `bookingId`      | string  | Booking that owns this allocation, or `null` for raw blocks                                          |
| `active`         | boolean | `true` = blocks time, `false` = historical record                                                    |
| `startAt`        | string  | Start of the blocked time window (ISO 8601). Includes buffer if from a booking with a buffer policy. |
| `endAt`          | string  | End of the blocked time window (ISO 8601). Includes buffer if from a booking with a buffer policy.   |
| `bufferBeforeMs` | number  | Buffer time before the customer appointment (ms). `0` for raw allocations.                           |
| `bufferAfterMs`  | number  | Buffer time after the customer appointment (ms). `0` for raw allocations.                            |
| `expiresAt`      | string  | Expiration time, or `null` for permanent blocks                                                      |
| `metadata`       | object  | Arbitrary key-value data                                                                             |
| `createdAt`      | string  | Creation timestamp                                                                                   |
| `updatedAt`      | string  | Last update timestamp                                                                                |
