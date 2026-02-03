# Floyd Engine

> **Dev Preview** - APIs may change. Not recommended for production use yet.

Headless booking infrastructure for AI agents.

- **Hold → Confirm** - Two-phase booking for async workflows
- **Race-safe** - Database-level conflict detection
- **Retry-friendly** - Idempotent operations with automatic deduplication
- **Real-time** - Webhooks for booking events

## Why Floyd?

Building booking into AI agents is harder than it looks:

- **Async conversations** - Users say "yes" seconds after you check availability
- **Retries & timeouts** - Network failures cause duplicate bookings
- **Concurrency** - Multiple agents booking the same resource

Floyd handles all of this so you can focus on your agent.

## Example

```bash
# 1. Create a hold (reserves the slot until confirmed or expired)
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/allocations \
  -H "Content-Type: application/json" \
  -d '{
    "resourceId": "doctor-alice",
    "startAt": "2024-01-15T10:00:00Z",
    "endAt": "2024-01-15T11:00:00Z",
    "expiresAt": "2024-01-15T09:55:00Z"
  }'

# 2. Confirm when user says "yes"
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/allocations/$ALLOC_ID/confirm

# 3. Or cancel if they change their mind
curl -X POST http://localhost:4000/v1/ledgers/$LEDGER_ID/allocations/$ALLOC_ID/cancel

# Overlapping requests get 409 Conflict - double-booking is impossible
```

## Quick Start

```bash
docker run \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -p 4000:4000 \
  ghcr.io/floyd-run/engine:master
```

See the [Quickstart guide](https://docs.floyd.run/docs/quickstart) for Docker Compose setup and full instructions.

## Documentation

Full API reference, guides, and examples at [docs.floyd.run](https://docs.floyd.run)

## Feedback

This is a dev preview - we'd love your input! Open an issue on [GitHub](https://github.com/floyd-run/engine/issues) or reach out at [hey@floyd.run](mailto:hey@floyd.run).

## License

Apache 2.0
