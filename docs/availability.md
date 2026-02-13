# Availability

Floyd provides three ways to query availability depending on your use case:

| Endpoint                                        | Scope            | Returns                     | Best for                             |
| ----------------------------------------------- | ---------------- | --------------------------- | ------------------------------------ |
| [Resource availability](#resource-availability) | Raw resources    | Free/busy timeline          | Low-level checks                     |
| [Slots](#slots)                                 | Service + policy | Discrete bookable positions | Appointment booking (salon, doctor)  |
| [Windows](#windows)                             | Service + policy | Continuous available ranges | Rental booking (kayak, meeting room) |

## Slots

Returns discrete, grid-aligned time positions where a booking of the given duration could be placed. Policy rules (working hours, grid, buffers, lead time, horizon) are applied automatically.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID/availability/slots" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-03-16T00:00:00Z",
    "endTime": "2026-03-16T23:59:59Z",
    "durationMs": 3600000
  }'
```

Response:

```json
{
  "data": [
    {
      "resourceId": "rsc_01abc123def456ghi789jkl012",
      "timezone": "America/New_York",
      "slots": [
        { "startTime": "2026-03-16T13:00:00.000Z", "endTime": "2026-03-16T14:00:00.000Z" },
        { "startTime": "2026-03-16T13:30:00.000Z", "endTime": "2026-03-16T14:30:00.000Z" },
        { "startTime": "2026-03-16T14:00:00.000Z", "endTime": "2026-03-16T15:00:00.000Z" }
      ]
    }
  ],
  "meta": {
    "serverTime": "2026-03-16T10:00:00.000Z"
  }
}
```

### Request fields

| Field                | Type     | Required | Description                                                                   |
| -------------------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `startTime`          | string   | Yes      | Start of query window (ISO 8601)                                              |
| `endTime`            | string   | Yes      | End of query window (ISO 8601). Max 7 days from `startTime`.                  |
| `durationMs`         | number   | Yes      | Desired booking duration in milliseconds                                      |
| `resourceIds`        | string[] | No       | Filter to specific resources. Defaults to all resources in the service.       |
| `includeUnavailable` | boolean  | No       | When `true`, returns all grid positions with `status` field. Default `false`. |

### How slots are generated

1. **Day resolution**: Each day in the query range is resolved against the service's policy. Closed days and blackout dates are skipped.
2. **Grid alignment**: Within each day's open windows, candidate positions are placed at grid intervals (from `config.grid.interval_ms`). If no grid is configured, the step defaults to `durationMs`.
3. **Duration validation**: If the day's config restricts durations (`allowed_ms`, `min_ms`, `max_ms`) and `durationMs` doesn't pass, the entire day is skipped.
4. **Conflict check**: Each candidate is expanded by buffer times (`before_ms` / `after_ms`) and checked against existing allocations. Overlapping candidates are excluded.
5. **Lead time / horizon**: Candidates too close to `serverTime` (below `min_ms`) or too far out (beyond `max_ms`) are excluded.

### Overlapping slots

When the grid interval is smaller than the duration, slots overlap. For example, 60-minute slots on a 30-minute grid produce:

```
09:00–10:00, 09:30–10:30, 10:00–11:00, ...
```

This lets users pick the best start time rather than being locked to non-overlapping blocks.

### includeUnavailable

By default, only available slots are returned (no `status` field). With `includeUnavailable: true`, every grid position is returned with a `status` of `"available"` or `"unavailable"`:

```json
{
  "slots": [
    { "startTime": "...", "endTime": "...", "status": "available" },
    { "startTime": "...", "endTime": "...", "status": "unavailable" },
    { "startTime": "...", "endTime": "...", "status": "available" }
  ]
}
```

This is useful for rendering a full calendar grid with booked slots grayed out.

## Windows

Returns continuous available time ranges after subtracting existing allocations and applying buffer shrinkage. No grid alignment — windows represent the full bookable gaps.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID/availability/windows" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-03-16T00:00:00Z",
    "endTime": "2026-03-20T00:00:00Z"
  }'
```

Response:

```json
{
  "data": [
    {
      "resourceId": "rsc_01abc123def456ghi789jkl012",
      "timezone": "America/New_York",
      "windows": [
        { "startTime": "2026-03-16T13:00:00.000Z", "endTime": "2026-03-16T22:00:00.000Z" },
        { "startTime": "2026-03-17T13:00:00.000Z", "endTime": "2026-03-17T16:00:00.000Z" },
        { "startTime": "2026-03-17T18:00:00.000Z", "endTime": "2026-03-17T22:00:00.000Z" }
      ]
    }
  ],
  "meta": {
    "serverTime": "2026-03-16T10:00:00.000Z"
  }
}
```

### Request fields

| Field                | Type     | Required | Description                                                                             |
| -------------------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `startTime`          | string   | Yes      | Start of query window (ISO 8601)                                                        |
| `endTime`            | string   | Yes      | End of query window (ISO 8601). Max 31 days from `startTime`.                           |
| `resourceIds`        | string[] | No       | Filter to specific resources. Defaults to all resources in the service.                 |
| `includeUnavailable` | boolean  | No       | When `true`, also returns allocation times as `"unavailable"` windows. Default `false`. |

### How windows are computed

1. **Day resolution**: Same as slots — each day resolved against the policy.
2. **Schedule assembly**: Open windows across all days are converted to absolute time intervals and merged if contiguous (e.g., two 24h days merge into one 48h window).
3. **Allocation subtraction**: Existing allocations are carved out of the schedule windows.
4. **Buffer shrinkage**: Gaps adjacent to allocations are shrunk to account for new-booking buffer requirements:
   - Gap start touches an allocation → shrink start by `before_ms`
   - Gap end touches an allocation → shrink end by `after_ms`
   - Gap start/end at a schedule boundary → no shrinkage (buffers extend outside schedule)
5. **Minimum duration filter**: Windows shorter than `config.duration.min_ms` are discarded.
6. **Lead time / horizon**: Windows outside the lead time range are filtered.
7. **Merge**: Adjacent windows are merged into single ranges.

### Buffer shrinkage example

Given a schedule of 09:00–17:00 with `before_ms: 15min` and `after_ms: 10min`, and an existing allocation at 12:00–13:00:

```
Schedule:  |========================================|
           09:00                                  17:00

Alloc:                   |======|
                        12:00  13:00

Raw gaps:  |=============|      |===================|
           09:00       12:00  13:00               17:00

After shrinkage:
           |=========|            |=================|
           09:00   11:50        13:15             17:00
                    ↑ -10min     ↑ +15min
                    (after_ms)   (before_ms)
```

The gap before the allocation shrinks at its end by `after_ms` (the new booking would need a post-buffer). The gap after the allocation shrinks at its start by `before_ms` (the new booking would need a pre-buffer). Schedule boundaries don't shrink — buffers are allowed to extend outside the schedule.

### includeUnavailable

With `includeUnavailable: true`, allocation times within schedule hours are also returned with `status: "unavailable"`:

```json
{
  "windows": [
    { "startTime": "...", "endTime": "...", "status": "available" },
    { "startTime": "...", "endTime": "...", "status": "unavailable" },
    { "startTime": "...", "endTime": "...", "status": "available" }
  ]
}
```

## Filtering by resource

Both slots and windows accept an optional `resourceIds` array to query specific resources within the service:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID/availability/slots" \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-03-16T00:00:00Z",
    "endTime": "2026-03-16T23:59:59Z",
    "durationMs": 3600000,
    "resourceIds": ["rsc_01abc123def456ghi789jkl012"]
  }'
```

If omitted, all resources belonging to the service are included. Each resource gets independent results in the `data` array. Returns `422` if a resource ID doesn't belong to the service.

## No policy behavior

If the service has no policy attached:

- All times are considered open (24h schedule)
- No duration, grid, buffer, or lead time constraints
- Only existing allocations block time
- Slots step defaults to `durationMs`

## Timezone handling

Every resource has a required `timezone` field (IANA format, e.g., `"America/New_York"`). Schedule windows (e.g., "09:00–17:00") are interpreted in the resource's timezone, including DST transitions. The resolved `timezone` is included in each resource's response entry.

## Resource availability

For low-level free/busy checks without policy evaluation, query resource availability directly:

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/availability" \
  -H "Content-Type: application/json" \
  -d '{
    "resourceIds": ["rsc_01abc123def456ghi789jkl012"],
    "startTime": "2026-01-04T10:00:00Z",
    "endTime": "2026-01-04T18:00:00Z"
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
          "startTime": "2026-01-04T10:00:00.000Z",
          "endTime": "2026-01-04T11:00:00.000Z",
          "status": "free"
        },
        {
          "startTime": "2026-01-04T11:00:00.000Z",
          "endTime": "2026-01-04T12:00:00.000Z",
          "status": "busy"
        },
        {
          "startTime": "2026-01-04T12:00:00.000Z",
          "endTime": "2026-01-04T18:00:00.000Z",
          "status": "free"
        }
      ]
    }
  ]
}
```

This endpoint doesn't know about services or policies — it only reports raw allocation conflicts.

### What counts as "busy"

A time slot is marked `busy` if it overlaps with an active, non-expired allocation:

- `active = true` and `expiresAt` is null (permanent block)
- `active = true` and `expiresAt > now()` (temporary block, not yet expired)

These do **not** block time:

- `active = false` (cancelled/expired booking allocations)
- Expired allocations (`expiresAt <= now()`)

Both booking-owned and raw allocations are considered.

### Timeline behavior

- **Clamping**: Allocations extending outside the query window are clamped to fit
- **Merging**: Overlapping and adjacent busy blocks are merged into single blocks
- **Gaps filled**: Free blocks are automatically generated for unoccupied time

## Use case: slots for an appointment

```javascript
const { data, meta } = await fetch(
  `${baseUrl}/v1/ledgers/${ledgerId}/services/${serviceId}/availability/slots`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startTime, endTime, durationMs: 3600000 }),
  },
).then((r) => r.json());

// Pick the first available slot for any resource
for (const resource of data) {
  if (resource.slots.length > 0) {
    const slot = resource.slots[0];
    console.log(`Book ${resource.resourceId} at ${slot.startTime}`);
    break;
  }
}
```

## Use case: find a rental window

```javascript
const { data } = await fetch(
  `${baseUrl}/v1/ledgers/${ledgerId}/services/${serviceId}/availability/windows`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startTime, endTime }),
  },
).then((r) => r.json());

// Find a window that fits the desired rental duration
const minDuration = 4 * 60 * 60 * 1000; // 4 hours
for (const resource of data) {
  const suitable = resource.windows.find((w) => {
    const duration = new Date(w.endTime) - new Date(w.startTime);
    return duration >= minDuration;
  });
  if (suitable) {
    console.log(`Rent ${resource.resourceId}: ${suitable.startTime} to ${suitable.endTime}`);
    break;
  }
}
```
