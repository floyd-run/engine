# Time format

Floyd Engine stores timestamps in UTC and expects ISO 8601 inputs.

## Required format

Send `startTime` and `endTime` as ISO 8601 timestamps with either:

- `Z` (UTC), e.g. `2026-01-04T10:00:00Z`
- an explicit offset, e.g. `2026-01-04T10:00:00+03:00`

Avoid “naive” timestamps (no timezone), e.g. `2026-01-04T10:00:00`.

## Best practice

- For API calls: send UTC (`Z`)
- For UI: convert to/from user locale at the edge

## Interval rules

- `endTime` must be strictly greater than `startTime`
- intervals use `[startTime, endTime)` semantics (back-to-back allowed)
