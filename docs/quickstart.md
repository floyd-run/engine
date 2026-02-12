# Quickstart

Get Floyd Engine running and make your first booking in under 5 minutes.

## Run the Engine

### Option 1: Docker (recommended)

```bash
docker run \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -e FLOYD_API_KEY="your-secret-key" \
  -p 4000:4000 \
  ghcr.io/floyd-run/engine:master
```

The engine runs migrations automatically on startup.

**Environment variables:**

| Variable        | Required | Description                                               |
| --------------- | -------- | --------------------------------------------------------- |
| `DATABASE_URL`  | Yes      | PostgreSQL connection string                              |
| `FLOYD_API_KEY` | No       | API key for authentication. If not set, auth is disabled. |
| `PORT`          | No       | Server port (default: 4000)                               |

### Option 2: Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: floyd
      POSTGRES_USER: floyd
      POSTGRES_PASSWORD: floyd
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  engine:
    image: ghcr.io/floyd-run/engine:master
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgres://floyd:floyd@postgres:5432/floyd
      FLOYD_API_KEY: your-secret-key # optional
    ports:
      - "4000:4000"

volumes:
  postgres_data:
```

Then run:

```bash
docker-compose up
```

## Base URL

Once running, the API is available at:

```
http://localhost:4000
```

All endpoints below use the `/v1` prefix.

## Authentication

If you set `FLOYD_API_KEY`, include it in requests:

```bash
curl -H "Authorization: Bearer your-secret-key" \
  http://localhost:4000/v1/ledgers
```

If `FLOYD_API_KEY` is not set, authentication is disabled (useful for local development).

## 0) Create a ledger

Ledgers are containers for your resources, services, and bookings.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers" \
  -H "Content-Type: application/json"
```

Response:

```json
{
  "data": {
    "id": "ldg_01abc123def456ghi789jkl012",
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 1) Create a resource

Resources represent bookable entities (rooms, people, equipment, etc.).

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/resources" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:

```json
{
  "data": {
    "id": "rsc_01abc123def456ghi789jkl012",
    "ledgerId": "ldg_01abc123def456ghi789jkl012",
    "timezone": null,
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 2) Create a service

A service groups resources and optionally attaches a policy.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Haircut",
    "resourceIds": ["rsc_01abc123def456ghi789jkl012"]
  }'
```

Response:

```json
{
  "data": {
    "id": "svc_01abc123def456ghi789jkl012",
    "ledgerId": "ldg_01abc123def456ghi789jkl012",
    "name": "Haircut",
    "policyId": null,
    "resourceIds": ["rsc_01abc123def456ghi789jkl012"],
    "metadata": null,
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 3) Create a hold

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{
    "serviceId": "svc_01abc123def456ghi789jkl012",
    "resourceId": "rsc_01abc123def456ghi789jkl012",
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T10:30:00Z",
    "metadata": { "source": "quickstart" }
  }'
```

Response:

```json
{
  "data": {
    "id": "bkg_01abc123def456ghi789jkl012",
    "ledgerId": "ldg_01abc123def456ghi789jkl012",
    "serviceId": "svc_01abc123def456ghi789jkl012",
    "status": "hold",
    "expiresAt": "2026-01-04T10:15:00.000Z",
    "allocations": [
      {
        "id": "alc_01abc123def456ghi789jkl012",
        "resourceId": "rsc_01abc123def456ghi789jkl012",
        "startAt": "2026-01-04T10:00:00.000Z",
        "endAt": "2026-01-04T10:30:00.000Z",
        "active": true
      }
    ],
    "metadata": { "source": "quickstart" },
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  },
  "meta": {
    "serverTime": "2026-01-04T10:00:00.000Z"
  }
}
```

Error responses:

- `409 Conflict` if the slot overlaps with an existing active allocation
- `409 Conflict` if the service's policy rejects the request
- `422 Unprocessable Entity` if your input is invalid

## 4) Confirm the booking

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/confirm" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `confirmed` and `expiresAt: null`
- `409 Conflict` if the hold expired before you confirmed
- Safe to retry (confirming an already confirmed booking returns the confirmed booking)

## 5) Cancel a booking

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID/cancel" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `cancelled` and allocations deactivated (`active: false`)
- Safe to retry (cancelling an already cancelled booking returns the booking)

## 6) Get a booking

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings/$BOOKING_ID"
```

Returns the booking with nested allocations.

## 7) List bookings

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings"
```

## Next

- [Services](./services.md) - Grouping resources with policies
- [Bookings](./bookings.md) - The reservation lifecycle
- [Allocations](./allocations.md) - Raw time blocks and ad-hoc blocking
- [Availability](./availability.md) - Slots, windows, and free/busy timelines
- [Policies](./policies.md) - Scheduling rules
- [Idempotency](./idempotency.md) - Safe retries
- [Webhooks](./webhooks.md) - Real-time notifications
- [Errors](./errors.md) - Error handling
