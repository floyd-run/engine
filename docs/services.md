# Services

A service represents a bookable offering. It groups resources and optionally attaches a policy to enforce scheduling rules.

## Creating a service

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Yoga Class",
    "policyId": "pol_01abc123...",
    "resourceIds": ["rsc_01abc123...", "rsc_01def456..."],
    "metadata": { "category": "wellness" }
  }'
```

Response:

```json
{
  "data": {
    "id": "svc_01abc123...",
    "ledgerId": "ldg_01xyz789...",
    "name": "Yoga Class",
    "policyId": "pol_01abc123...",
    "resourceIds": ["rsc_01abc123...", "rsc_01def456..."],
    "metadata": { "category": "wellness" },
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

### Fields

| Field         | Type     | Required | Description                                                 |
| ------------- | -------- | -------- | ----------------------------------------------------------- |
| `name`        | string   | Yes      | Display name (1-255 characters)                             |
| `policyId`    | string   | No       | Policy to enforce on bookings. `null` means no constraints. |
| `resourceIds` | string[] | No       | Resources available for this service. Defaults to `[]`.     |
| `metadata`    | object   | No       | Arbitrary key-value data                                    |

All resources and the policy (if provided) must belong to the same ledger.

## Updating a service

Updates use **full replace** semantics (PUT). All fields are replaced, including `resourceIds`.

```bash
curl -X PUT "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Advanced Yoga",
    "policyId": null,
    "resourceIds": ["rsc_01def456..."],
    "metadata": null
  }'
```

To add or remove resources, send the full desired list. There is no PATCH — send all fields on every update.

## Deleting a service

```bash
curl -X DELETE "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID"
```

- Returns `204 No Content` on success
- Returns `409 Conflict` with code `active_bookings_exist` if the service has bookings in `hold` or `confirmed` status
- Cancelled and expired bookings do not block deletion

## Getting a service

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services/$SERVICE_ID"
```

## Listing services

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services"
```

## How services connect to bookings

When a booking is created against a service:

1. The resource must belong to the service
2. If the service has a policy, the booking is evaluated against its rules
3. The policy uses the resource's timezone for time-of-day rules (or UTC if no timezone is set)

A resource can belong to multiple services. For example, "Room A" could be used by both "Yoga Class" and "Meeting Rental" services, each with different policies.

## Example: salon setup

```bash
# Create a policy with weekday hours
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/policies" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
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
  }'

# Create resources for two stylists
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/resources" \
  -H "Content-Type: application/json" \
  -d '{ "timezone": "America/New_York" }'
# → rsc_stylist1

curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/resources" \
  -H "Content-Type: application/json" \
  -d '{ "timezone": "America/New_York" }'
# → rsc_stylist2

# Create a service grouping both stylists with the policy
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Haircut",
    "policyId": "pol_...",
    "resourceIds": ["rsc_stylist1", "rsc_stylist2"]
  }'
```

Now bookings against the "Haircut" service will be validated against weekday 9-18 hours in New York time, with 30-minute grid slots and 10-minute cleanup buffers.
