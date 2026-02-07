# Availability

Query free/busy timelines for resources before creating allocations.

## Query availability

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/availability?resourceIds=$RESOURCE_ID&startAt=2026-01-04T10:00:00Z&endAt=2026-01-04T18:00:00Z"
```

Response:

```json
{
  "data": [
    {
      "resourceId": "rsc_01abc123def456ghi789jkl012",
      "timeline": [
        { "startAt": "2026-01-04T10:00:00.000Z", "endAt": "2026-01-04T11:00:00.000Z", "status": "free" },
        { "startAt": "2026-01-04T11:00:00.000Z", "endAt": "2026-01-04T12:00:00.000Z", "status": "busy" },
        { "startAt": "2026-01-04T12:00:00.000Z", "endAt": "2026-01-04T18:00:00.000Z", "status": "free" }
      ]
    }
  ]
}
```

## Multiple resources

Query multiple resources in a single request:

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/availability?resourceIds=$RESOURCE_1&resourceIds=$RESOURCE_2&startAt=2026-01-04T10:00:00Z&endAt=2026-01-04T18:00:00Z"
```

Each resource gets its own timeline in the response.

## What counts as "busy"

A time slot is marked `busy` if it overlaps with:

- A `hold` allocation that hasn't expired
- A `confirmed` allocation

Expired holds and cancelled allocations do **not** block time.

## Timeline behavior

- **Clamping**: Allocations extending outside the query window are clamped to fit
- **Merging**: Overlapping and adjacent busy blocks are merged into single blocks
- **Gaps filled**: Free blocks are automatically generated for unoccupied time

## Use case: find available slots

1. Query availability for the desired time window
2. Find `free` blocks that match your duration requirements
3. Create a hold on the chosen slot

```javascript
const { data } = await fetch(`${baseUrl}/v1/ledgers/${ledgerId}/availability?...`).then(r => r.json());

const freeSlots = data[0].timeline.filter(block => block.status === "free");
const suitableSlot = freeSlots.find(slot => {
  const duration = new Date(slot.endAt) - new Date(slot.startAt);
  return duration >= requiredDuration;
});
```
