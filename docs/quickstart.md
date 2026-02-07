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

## 0) Create a ledger (if needed)

Ledgers are containers for your resources and allocations.

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

Resources represent bookable entities (rooms, people, services, etc.). You need at least one resource before creating allocations.

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
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 2) Create a hold

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{
    "resourceId": "rsc_01abc123def456ghi789jkl012",
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T10:30:00Z",
    "expiresAt": "2026-01-04T10:05:00Z",
    "metadata": { "source": "quickstart" }
  }'
```

Response:

```json
{
  "data": {
    "id": "alc_01abc123def456ghi789jkl012",
    "ledgerId": "ldg_01abc123def456ghi789jkl012",
    "resourceId": "rsc_01abc123def456ghi789jkl012",
    "startAt": "2026-01-04T10:00:00.000Z",
    "endAt": "2026-01-04T10:30:00.000Z",
    "status": "hold",
    "expiresAt": "2026-01-04T10:05:00.000Z",
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

- `409 Conflict` if someone already holds/confirmed that slot
- `400 Bad Request` if your input is invalid

## 3) Confirm the hold

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations/$ALLOCATION_ID/confirm" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `confirmed`
- `409 Conflict` if the hold expired before you confirmed
- Safe to retry (confirming an already confirmed allocation returns the confirmed allocation)

## 4) Cancel an allocation

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations/$ALLOCATION_ID/cancel" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `cancelled`
- Safe to retry (cancelling an already cancelled/expired allocation returns the allocation)

## 5) Get an allocation

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations/$ALLOCATION_ID" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with the allocation object
- `404 Not Found` if the allocation doesn't exist

## 6) List allocations

```bash
curl "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/allocations" \
  -H "Content-Type: application/json"
```

Response:

```json
{
  "data": [
    {
      "id": "alc_01abc123def456ghi789jkl012",
      "ledgerId": "ldg_01abc123def456ghi789jkl012",
      "resourceId": "rsc_01abc123def456ghi789jkl012",
      "status": "confirmed",
      "startAt": "2026-01-04T10:00:00.000Z",
      "endAt": "2026-01-04T10:30:00.000Z",
      "expiresAt": null,
      "metadata": { "source": "quickstart" },
      "createdAt": "2026-01-04T10:00:00.000Z",
      "updatedAt": "2026-01-04T10:00:00.000Z"
    }
  ]
}
```

## Next

- [Allocations](./allocations.md) - Deep dive into the booking model
- [Availability](./availability.md) - Query free/busy timelines
- [Idempotency](./idempotency.md) - Safe retries
- [Webhooks](./webhooks.md) - Real-time notifications
- [Errors](./errors.md) - Error handling
