# Time format

Floyd Engine stores timestamps in UTC and expects ISO 8601 inputs.

## Required format

Send `startAt` and `endAt` as ISO 8601 timestamps with either:

- `Z` (UTC), e.g. `2026-01-04T10:00:00Z`
- an explicit offset, e.g. `2026-01-04T10:00:00+03:00`

Avoid “naive” timestamps (no timezone), e.g. `2026-01-04T10:00:00`.

## Best practice

- For API calls: send UTC (`Z`)
- For UI: convert to/from user locale at the edge
- For scheduling rules (business hours): use a resource/org timezone (when you add availability logic)

## Interval rules

- `endAt` must be strictly greater than `startAt`
- intervals use `[startAt, endAt)` semantics (back-to-back allowed)
