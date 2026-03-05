# Floyd Engine

Open-source booking engine for AI agents. Two-phase booking, conflict detection, and scheduling policies — built for concurrent workloads.

- **Hold → Confirm** - Reserve a slot with TTL, confirm when ready, auto-expire if not
- **Conflict detection** - Database-level row locking + GiST indexes prevent double-booking
- **Scheduling policies** - Working hours, buffers, lead times, grid alignment
- **Idempotency** - Safe retries via `Idempotency-Key` header
- **Webhooks** - HMAC-signed booking events via transactional outbox

## Example

```bash
# 1. Create a service (groups resources with a policy)
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Haircut",
    "resourceIds": ["rsc_stylist1"]
  }'

# 2. Create a hold (reserves the slot until confirmed or expired)
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "svc_...",
    "resourceId": "rsc_stylist1",
    "startTime": "2026-03-15T10:00:00Z",
    "endTime": "2026-03-15T11:00:00Z"
  }'

# 3. Confirm when user says "yes"
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/confirm

# 4. Or cancel if they change their mind
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/cancel

# Overlapping requests get 409 Conflict - double-booking is impossible
```

## Quick Start

```bash
docker run \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -p 4000:4000 \
  ghcr.io/floyd-run/engine:master
```

See the [Quickstart guide](docs/quickstart.md) for Docker Compose setup and full instructions.

## Documentation

Full API reference, guides, and examples in the [docs](docs/) folder.

## Managed Cloud

Prefer not to self-host? [floyd.run](https://floyd.run) is a hosted version with organizations, API keys, and a web console.

## Feedback

Open an issue on [GitHub](https://github.com/floyd-run/engine/issues) or reach out at [hey@floyd.run](mailto:hey@floyd.run).

## License

Apache 2.0
