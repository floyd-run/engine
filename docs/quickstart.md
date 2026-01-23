# Quickstart

This gets you from "API key" to "hold → confirm → cancel".

## Prerequisites

Before creating allocations, you'll need:

- An API key
- A workspace ID
- A resource (represents a bookable entity like a room, person, or service)

## Base URL

Use your Floyd Engine API base URL:

- Local: `http://localhost:3000`
- Production: `https://engine.floyd.run`

All endpoints below assume `/v1`.

## 0) Create a workspace (if needed)

Workspaces are containers for your resources and allocations.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/workspaces" \
  -H "Content-Type: application/json"
```

Response:

```json
{
  "data": {
    "id": "ws_01abc123def456ghi789jkl012",
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 1) Create a resource

Resources represent bookable entities (rooms, people, services, etc.). You need at least one resource before creating allocations.

```bash
curl -X POST "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/resources" \
  -H "Content-Type: application/json" \
  -d '{
    "timezone": "America/New_York"
  }'
```

Response:

```json
{
  "data": {
    "id": "res_01abc123def456ghi789jkl012",
    "workspaceId": "ws_01abc123def456ghi789jkl012",
    "timezone": "America/New_York",
    "createdAt": "2026-01-04T10:00:00.000Z",
    "updatedAt": "2026-01-04T10:00:00.000Z"
  }
}
```

## 2) Create a hold

```bash
curl -X POST "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/allocations" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-001" \
  -d '{
    "resourceId": "res_01abc123def456ghi789jkl012",
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
    "id": "alloc_01abc123def456ghi789jkl012",
    "workspaceId": "ws_01abc123def456ghi789jkl012",
    "resourceId": "res_01abc123def456ghi789jkl012",
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
curl -X POST "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/allocations/$ALLOCATION_ID/confirm" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `confirmed`
- `409 Conflict` if the hold expired before you confirmed
- Safe to retry (confirming an already confirmed allocation returns the confirmed allocation)

## 4) Cancel an allocation

```bash
curl -X POST "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/allocations/$ALLOCATION_ID/cancel" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with status `cancelled`
- Safe to retry (cancelling an already cancelled/expired allocation returns the allocation)

## 5) Get an allocation

```bash
curl "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/allocations/$ALLOCATION_ID" \
  -H "Content-Type: application/json"
```

Expected:

- `200 OK` with the allocation object
- `404 Not Found` if the allocation doesn't exist

## 6) List allocations

```bash
curl "$FLOYD_BASE_URL/v1/workspaces/$WORKSPACE_ID/allocations" \
  -H "Content-Type: application/json"
```

Response:

```json
{
  "data": [
    {
      "id": "alloc_01abc123def456ghi789jkl012",
      "workspaceId": "ws_01abc123def456ghi789jkl012",
      "resourceId": "res_01abc123def456ghi789jkl012",
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

- [The Booking Kernel](./concepts/booking-kernel.md)
- [Idempotency](./concepts/idempotency.md)
- [Errors](./concepts/errors.md)
