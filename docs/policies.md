# Policies

Policies define scheduling rules for a ledger — working hours, duration constraints, grid alignment, lead times, and buffers. When a policy is attached to a ledger, booking requests are evaluated against its rules before conflict detection.

## How it works

A policy has a **default** stance (`open` or `closed`) and an ordered list of **rules**. Each rule matches specific days or dates and can override the default with time windows and config overrides.

When evaluating a booking request, Floyd:

1. Checks for blackout dates (closed rules on any overlapped day)
2. Finds the first matching rule for the start date
3. Determines if the time is within allowed windows
4. Merges the rule's config with the base config
5. Validates duration, grid alignment, lead time, and horizon
6. Computes buffer times

## Creating a policy

```bash
curl -X POST https://api.floyd.run/v1/ledgers/{ledgerId}/policies \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "schema_version": 1,
      "default": "closed",
      "config": {
        "duration": {
          "min_minutes": 30,
          "max_minutes": 120,
          "allowed_minutes": [30, 60, 90, 120]
        },
        "grid": {
          "interval_minutes": 30
        },
        "booking_window": {
          "min_lead_time_hours": 1,
          "max_lead_time_days": 30
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

## Config format

Policies use an **authoring format** with friendly units. Floyd normalizes everything to milliseconds for storage.

| Authoring field | Canonical field | Conversion   |
| --------------- | --------------- | ------------ |
| `*_minutes`     | `*_ms`          | × 60,000     |
| `*_hours`       | `*_ms`          | × 3,600,000  |
| `*_days`        | `*_ms`          | × 86,400,000 |

If both `*_ms` and a friendly unit are provided, `*_ms` takes precedence.

### Duration

Controls allowed booking lengths.

| Field        | Description                              |
| ------------ | ---------------------------------------- |
| `min_ms`     | Minimum duration in milliseconds         |
| `max_ms`     | Maximum duration in milliseconds         |
| `allowed_ms` | Exact allowed durations (takes priority) |

### Grid

Constrains start times to fixed intervals.

| Field         | Description                           |
| ------------- | ------------------------------------- |
| `interval_ms` | Start times must be multiples of this |

### Booking window

Controls how far in advance bookings can be made.

| Field              | Description                                |
| ------------------ | ------------------------------------------ |
| `min_lead_time_ms` | Minimum time between now and booking start |
| `max_lead_time_ms` | Maximum time between now and booking start |

### Buffers

Adds padding around allocations for setup/cleanup time.

| Field       | Description                         |
| ----------- | ----------------------------------- |
| `before_ms` | Buffer before the allocation starts |
| `after_ms`  | Buffer after the allocation ends    |

## Rules

Rules are evaluated in order — **first match wins**. Each rule has a `match` condition and either marks the day as `closed` or provides time windows and config overrides.

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

Closed rules cannot have `windows` or `config`.

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

### Config overrides

Rules can override the base config at the section level:

```json
{
  "match": { "type": "weekly", "days": ["saturday"] },
  "windows": [{ "start": "10:00", "end": "14:00" }],
  "config": {
    "duration": { "max_minutes": 60 }
  }
}
```

When a rule matches, its config sections **replace** (not merge) the corresponding base config sections.

## Default behavior

- `"default": "open"` — all times are bookable unless restricted by rules
- `"default": "closed"` — nothing is bookable unless opened by rule windows

## Config hashing

Each policy config is canonicalized and hashed (SHA-256). The `configHash` field in the response can be used to detect duplicate configurations.

## Common patterns

### Salon (weekday business hours)

```json
{
  "schema_version": 1,
  "default": "closed",
  "config": {
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
  "default": "closed",
  "config": {
    "duration": { "allowed_minutes": [15, 30] },
    "grid": { "interval_minutes": 15 },
    "booking_window": { "min_lead_time_hours": 2 }
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
  "default": "open",
  "config": {
    "duration": { "min_minutes": 60, "max_hours": 4 },
    "grid": { "interval_minutes": 60 }
  },
  "rules": []
}
```
