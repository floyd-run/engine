# Policies

Policies define scheduling rules for a service — working hours, duration constraints, grid alignment, lead times, and buffers. When a policy is attached to a service, booking requests are evaluated against its rules before conflict detection.

## How it works

A policy has a **default_availability** stance (`open` or `closed`) and an ordered list of **rules**. Each rule matches specific days or dates and can override the default with time windows and constraint overrides.

When evaluating a booking request, Floyd:

1. Checks for blackout dates (closed rules on any overlapped day)
2. Finds the first matching rule for the start date
3. Determines if the time is within allowed windows
4. Merges the rule's overrides with the base constraints
5. Validates duration, grid alignment, lead time, and horizon
6. Computes buffer times

## Versioning

Every policy create or update creates an immutable **version**. The policy response includes:

- `currentVersionId` — the active version (`pvr_...`)
- `config` — the normalized canonical config (all values in milliseconds)
- `configSource` — the original authoring input exactly as sent
- `configHash` — SHA-256 of the canonicalized config

Bookings store the `policyVersionId` that was active at booking time. This enables full auditability — you can always determine what rules applied to a booking by joining on the version.

## Creating a policy

```bash
curl -X POST https://api.floyd.run/v1/ledgers/{ledgerId}/policies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekday Hours",
    "description": "Mon-Fri 9am-5pm with 30-minute slots",
    "config": {
      "schema_version": 1,
      "default_availability": "closed",
      "constraints": {
        "duration": {
          "min_minutes": 30,
          "max_minutes": 120,
          "allowed_minutes": [30, 60, 90, 120]
        },
        "grid": {
          "interval_minutes": 30
        },
        "lead_time": {
          "min_hours": 1,
          "max_days": 30
        },
        "buffers": {
          "before_minutes": 5,
          "after_minutes": 10
        }
      },
      "rules": [
        {
          "match": { "type": "weekly", "days": ["weekdays"] },
          "windows": [
            { "start": "09:00", "end": "17:00" }
          ]
        },
        {
          "match": { "type": "date", "date": "2026-12-25" },
          "closed": true
        }
      ]
    }
  }'
```

### Fields

| Field         | Type   | Required | Description                      |
| ------------- | ------ | -------- | -------------------------------- |
| `name`        | string | No       | Display name (max 100 chars)     |
| `description` | string | No       | Description (max 500 chars)      |
| `config`      | object | Yes      | Policy configuration (see below) |

## Config format

Policies use an **authoring format** with friendly units. Floyd normalizes everything to milliseconds for storage.

| Authoring field | Canonical field | Conversion   |
| --------------- | --------------- | ------------ |
| `*_minutes`     | `*_ms`          | × 60,000     |
| `*_hours`       | `*_ms`          | × 3,600,000  |
| `*_days`        | `*_ms`          | × 86,400,000 |

If both `*_ms` and a friendly unit are provided, `*_ms` takes precedence.

The original authoring input is preserved in `configSource` on the response, so read-modify-write preserves the authoring shape.

### Constraints

Constraints are the base scheduling parameters. They live under `config.constraints`.

#### Duration

Controls allowed booking lengths.

| Field        | Description                              |
| ------------ | ---------------------------------------- |
| `min_ms`     | Minimum duration in milliseconds         |
| `max_ms`     | Maximum duration in milliseconds         |
| `allowed_ms` | Exact allowed durations (takes priority) |

#### Grid

Constrains start times to fixed intervals.

| Field         | Description                           |
| ------------- | ------------------------------------- |
| `interval_ms` | Start times must be multiples of this |

#### Lead time

Controls how far in advance bookings can be made.

| Field    | Description                            |
| -------- | -------------------------------------- |
| `min_ms` | Minimum lead time before booking start |
| `max_ms` | Maximum lead time before booking start |

#### Buffers

Adds padding around allocations for setup/cleanup time.

| Field       | Description                         |
| ----------- | ----------------------------------- |
| `before_ms` | Buffer before the allocation starts |
| `after_ms`  | Buffer after the allocation ends    |

## Rules

Rules are evaluated in order — **first match wins**. Each rule has a `match` condition and either marks the day as `closed` or provides time windows and constraint overrides.

### Match types

**Weekly** — matches by day of week:

```json
{ "type": "weekly", "days": ["monday", "wednesday", "friday"] }
```

Day shorthands are supported: `weekdays` (Mon-Fri), `weekends` (Sat-Sun), `everyday` (all days).

**Date** — matches a specific date:

```json
{ "type": "date", "date": "2026-12-25" }
```

**Date range** — matches a range of dates:

```json
{ "type": "date_range", "from": "2026-12-23", "to": "2026-12-31" }
```

Optionally filter by day within the range:

```json
{ "type": "date_range", "from": "2026-01-01", "to": "2026-06-30", "days": ["saturday"] }
```

### Closed rules

Mark dates as completely unavailable:

```json
{ "match": { "type": "date", "date": "2026-12-25" }, "closed": true }
```

Closed rules cannot have `windows` or `overrides`.

### Windows

Define open time ranges for a rule:

```json
{
  "match": { "type": "weekly", "days": ["weekdays"] },
  "windows": [
    { "start": "09:00", "end": "12:00" },
    { "start": "13:00", "end": "17:00" }
  ]
}
```

### Constraint overrides

Rules can override the base constraints at the section level:

```json
{
  "match": { "type": "weekly", "days": ["saturday"] },
  "windows": [{ "start": "10:00", "end": "14:00" }],
  "overrides": {
    "duration": { "max_minutes": 60 }
  }
}
```

When a rule matches, its override sections **replace** (not merge) the corresponding base constraint sections. If a rule overrides `duration`, the rule owns the entire `duration` section — base duration constraints do not apply for that match.

## Default behavior

- `"default_availability": "open"` — all times are bookable unless restricted by rules
- `"default_availability": "closed"` — nothing is bookable unless opened by rule windows

## Response format

```json
{
  "data": {
    "id": "pol_...",
    "ledgerId": "ldg_...",
    "name": "Weekday Hours",
    "description": "Mon-Fri 9am-5pm with 30-minute slots",
    "currentVersionId": "pvr_...",
    "config": {
      "schema_version": 1,
      "default_availability": "closed",
      "constraints": {
        "duration": { "min_ms": 1800000, "max_ms": 7200000, "allowed_ms": [1800000, 3600000, 5400000, 7200000] },
        "grid": { "interval_ms": 1800000 },
        "lead_time": { "min_ms": 3600000, "max_ms": 2592000000 },
        "buffers": { "before_ms": 300000, "after_ms": 600000 }
      },
      "rules": [...]
    },
    "configSource": {
      "schema_version": 1,
      "default_availability": "closed",
      "constraints": {
        "duration": { "min_minutes": 30, "max_minutes": 120, "allowed_minutes": [30, 60, 90, 120] },
        "grid": { "interval_minutes": 30 },
        "lead_time": { "min_hours": 1, "max_days": 30 },
        "buffers": { "before_minutes": 5, "after_minutes": 10 }
      },
      "rules": [...]
    },
    "configHash": "sha256:...",
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## Config hashing

Each policy config is canonicalized and hashed (SHA-256). The `configHash` field in the response can be used to detect duplicate configurations. Rule IDs are excluded from the hash — two configs with identical evaluation semantics but different rule IDs produce the same hash.

## Common patterns

### Salon (weekday business hours)

```json
{
  "schema_version": 1,
  "default_availability": "closed",
  "constraints": {
    "duration": { "allowed_minutes": [30, 60, 90] },
    "grid": { "interval_minutes": 30 },
    "buffers": { "after_minutes": 10 }
  },
  "rules": [
    {
      "match": { "type": "weekly", "days": ["weekdays"] },
      "windows": [{ "start": "09:00", "end": "18:00" }]
    }
  ]
}
```

### Doctor (weekdays with lunch break)

```json
{
  "schema_version": 1,
  "default_availability": "closed",
  "constraints": {
    "duration": { "allowed_minutes": [15, 30] },
    "grid": { "interval_minutes": 15 },
    "lead_time": { "min_hours": 2 }
  },
  "rules": [
    {
      "match": { "type": "weekly", "days": ["weekdays"] },
      "windows": [
        { "start": "08:00", "end": "12:00" },
        { "start": "13:00", "end": "17:00" }
      ]
    }
  ]
}
```

### 24/7 (always open with constraints)

```json
{
  "schema_version": 1,
  "default_availability": "open",
  "constraints": {
    "duration": { "min_minutes": 60, "max_hours": 4 },
    "grid": { "interval_minutes": 60 }
  },
  "rules": []
}
```
