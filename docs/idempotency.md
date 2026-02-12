# Idempotency

Agents retry. Networks fail. Timeouts happen.

Idempotency makes mutating POST endpoints safe to retry without creating duplicates or confusing conflicts.

## How it works

On create, you can provide:

- `Idempotency-Key` header (string, optional)

The key is scoped to your request. If you send the same key with the same significant fields, you get the cached response.

## Supported endpoints

| Endpoint                     | Significant fields                                      |
| ---------------------------- | ------------------------------------------------------- |
| `POST /allocations`          | `resourceId`, `startAt`, `endAt`, `expiresAt`           |
| `POST /bookings`             | `serviceId`, `resourceId`, `startAt`, `endAt`, `status` |
| `POST /bookings/:id/confirm` | (none — scoped to booking ID)                           |
| `POST /bookings/:id/cancel`  | (none — scoped to booking ID)                           |

## Behavior

### Safe retry (replay)

If you repeat the same create request with the same:

- `Idempotency-Key` header
- Request body (significant fields)

Floyd returns the cached response from the original request.

### Semantic mismatch (conflict)

If you reuse the same `Idempotency-Key` but change significant fields:

- Floyd returns **409 Conflict** with code `IDEMPOTENCY_MISMATCH`

This prevents a retry from accidentally "turning into" a different booking.

## Usage

```bash
curl -X POST "$FLOYD_BASE_URL/v1/ledgers/$LEDGER_ID/bookings" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-request-id-123" \
  -d '{
    "serviceId": "svc_01abc123...",
    "resourceId": "rsc_01abc123...",
    "startAt": "2026-01-04T10:00:00Z",
    "endAt": "2026-01-04T10:30:00Z"
  }'
```

## Recommendation

For agents:

- Set a new `Idempotency-Key` per "user intent"
- Reuse it across retries until you get a definitive success/failure

Examples:

- `call:<callSid>:intent:<n>`
- `conversation:<id>:turn:<n>`
- `workflow:<executionId>:step:book`

## Built-in idempotency on confirm/cancel

The `confirm` and `cancel` booking endpoints are idempotent by default:

- Confirming an already confirmed booking returns the confirmed booking
- Cancelling an already cancelled booking returns the cancelled booking

You can still use `Idempotency-Key` header for additional safety on these endpoints.
