# Availability

Query free/busy timelines for resources before creating bookings or allocations.

## Query availability

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/availability" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceIds": ["rsc_01abc123def456ghi789jkl012"],
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T18:00:00Z"
  }'
```

Response:

```json
{
  "data": [
    {
      "resourceId": "rsc_01abc123def456ghi789jkl012",
      "timeline": [
        {
          "startAt": "2026-01-04T10:00:00.000Z",
          "endAt": "2026-01-04T11:00:00.000Z",
          "status": "free"
        },
        {
          "startAt": "2026-01-04T11:00:00.000Z",
          "endAt": "2026-01-04T12:00:00.000Z",
          "status": "busy"
        },
        {
          "startAt": "2026-01-04T12:00:00.000Z",
          "endAt": "2026-01-04T18:00:00.000Z",
          "status": "free"
        }
      ]
    }
  ]
}
```

## Multiple resources

Query multiple resources in a single request:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/availability" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceIds": ["rsc_resource1", "rsc_resource2"],
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T18:00:00Z"
  }'
```

Each resource gets its own timeline in the response.

## What counts as "busy"

A time slot is marked `busy` if it overlaps with an active, non-expired allocation:

- `active = true` and `expiresAt` is null (permanent block)
- `active = true` and `expiresAt > now()` (temporary block, not yet expired)

These do **not** block time:

- `active = false` (cancelled/expired booking allocations)
- Expired allocations (`expiresAt <= now()`)

Both booking-owned and raw allocations are considered.

## Timeline behavior

- **Clamping**: Allocations extending outside the query window are clamped to fit
- **Merging**: Overlapping and adjacent busy blocks are merged into single blocks
- **Gaps filled**: Free blocks are automatically generated for unoccupied time

## Use case: find available slots

1. Query availability for the desired time window
2. Find `free` blocks that match your duration requirements
3. Create a booking on the chosen slot

```javascript
const { data } = await fetch(`${baseUrl}/v1/ledgers/${ledgerId}/availability`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ resourceIds, startAt, endAt }),
}).then((r) => r.json());

const freeSlots = data[0].timeline.filter((block) => block.status === "free");
const suitableSlot = freeSlots.find((slot) => {
  const duration = new Date(slot.endAt) - new Date(slot.startAt);
  return duration >= requiredDuration;
});
```
