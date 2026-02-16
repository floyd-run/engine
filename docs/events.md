# Events

Floyd Engine emits events when state changes occur (bookings created, allocations deleted, etc.). Events are stored durably using the **Transactional Outbox Pattern** and can be consumed via multiple transports.

## Event types

### Booking events

| Event               | Description                  |
| ------------------- | ---------------------------- |
| `booking.created`   | A new booking was created    |
| `booking.confirmed` | A hold booking was confirmed |
| `booking.canceled`  | A booking was canceled       |
| `booking.expired`   | A hold booking expired       |

### Allocation events

| Event                | Description                  |
| -------------------- | ---------------------------- |
| `allocation.created` | A raw allocation was created |
| `allocation.deleted` | A raw allocation was deleted |

## Event guarantees

- **Transactional safety** - Events are written in the same database transaction as the state change. If the transaction rolls back, no event is emitted.
- **At-least-once delivery** - Events are retried automatically on failure
- **Ordering** - Events are ordered by `created_at` within a ledger
- **Durability** - Events survive crashes and restarts

## Consuming events

### Option 1: Poll the outbox table

Query `outbox_events` directly from the database:

```sql
SELECT * FROM outbox_events
WHERE published_at IS NULL
ORDER BY created_at ASC
LIMIT 100;
```

After processing, mark events as published:

```sql
UPDATE outbox_events
SET published_at = NOW()
WHERE id = 'evt_...';
```

### Option 2: Subscribe via Redis Pub/Sub

Set `EVENT_BUS_MODE=redis` and subscribe to the event channel:

```typescript
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);
await redis.subscribe("floyd:internal:events");

redis.on("message", (channel, message) => {
  const event = JSON.parse(message);
  console.log(`Received ${event.type} for ledger ${event.ledgerId}`);
  // Process event
});
```

### Option 3: HTTP push to external service

Set `EVENT_BUS_MODE=http` to push events to an HTTP endpoint:

```bash
EVENT_BUS_MODE=http
EVENT_BUS_HTTP_URL=https://your-service.com/events
ENGINE_ID=engine-1
ENGINE_SECRET=your-secret-key
```

Events will be POSTed with an HMAC signature in the `Floyd-Signature` header.

### Option 4: Build a custom worker

Read from the outbox table and process events in a background worker:

```typescript
import { db } from "./database";

async function processEvents() {
  const events = await db
    .selectFrom("outboxEvents")
    .selectAll()
    .where("publishedAt", "is", null)
    .orderBy("createdAt", "asc")
    .limit(100)
    .execute();

  for (const event of events) {
    try {
      await handleEvent(event);

      await db
        .updateTable("outboxEvents")
        .set({ publishedAt: new Date() })
        .where("id", "=", event.id)
        .execute();
    } catch (error) {
      console.error(`Failed to process event ${event.id}:`, error);
    }
  }
}

setInterval(processEvents, 5000); // Poll every 5 seconds
```

## Event payload structure

All events follow this schema:

```typescript
interface Event {
  id: string; // Unique event ID (evt_...)
  type: string; // Event type (booking.created, etc.)
  ledgerId: string; // Which ledger
  timestamp: string; // ISO 8601 timestamp
  source: string; // Engine instance identifier
  schemaVersion: number; // Payload schema version (currently 1)
  data: {
    booking?: Booking; // Present for booking events
    allocation?: Allocation; // Present for allocation events
  };
}
```

### Example: booking.created

```json
{
  "id": "evt_01abc123...",
  "type": "booking.created",
  "ledgerId": "ldg_01xyz789...",
  "timestamp": "2026-01-15T10:00:00Z",
  "source": "engine-1",
  "schemaVersion": 1,
  "data": {
    "booking": {
      "id": "bkg_01def456...",
      "serviceId": "svc_01ghi789...",
      "status": "hold",
      "expiresAt": "2026-01-15T10:15:00Z",
      "allocations": [
        {
          "id": "alc_01jkl012...",
          "resourceId": "rsc_01mno345...",
          "startTime": "2026-01-15T14:00:00Z",
          "endTime": "2026-01-15T15:00:00Z"
        }
      ],
      "createdAt": "2026-01-15T10:00:00Z"
    }
  }
}
```

### Example: allocation.deleted

```json
{
  "id": "evt_01abc123...",
  "type": "allocation.deleted",
  "ledgerId": "ldg_01xyz789...",
  "timestamp": "2026-01-15T10:00:00Z",
  "source": "engine-1",
  "schemaVersion": 1,
  "data": {
    "allocation": {
      "id": "alc_01def456...",
      "resourceId": "rsc_01ghi789...",
      "startTime": "2026-01-15T14:00:00Z",
      "endTime": "2026-01-15T15:00:00Z",
      "active": false
    }
  }
}
```

## Configuration

Set the event bus mode via environment variables:

```bash
# None - events written to outbox only (default)
EVENT_BUS_MODE=none

# Redis - publish to Redis Pub/Sub channel
EVENT_BUS_MODE=redis
REDIS_URL=redis://localhost:6379

# HTTP - push to external HTTP endpoint
EVENT_BUS_MODE=http
EVENT_BUS_HTTP_URL=https://your-service.com/events
ENGINE_ID=engine-1
ENGINE_SECRET=your-secret-key
```

## Verifying HTTP signatures

When using `EVENT_BUS_MODE=http`, events are signed with HMAC-SHA256:

```typescript
import { createHmac } from "crypto";

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

// In your HTTP handler
app.post("/events", (req, res) => {
  const signature = req.headers["floyd-signature"];
  const payload = JSON.stringify(req.body);

  if (!verifySignature(payload, signature, process.env.ENGINE_SECRET)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = req.body;
  console.log(`Received ${event.type}`);

  res.status(200).send("OK");
});
```

## Best practices

1. **Idempotency** - Use `event.id` to deduplicate events. The engine may emit the same event multiple times.
2. **Error handling** - If processing fails, leave `published_at` as NULL so the event can be retried.
3. **Ordering** - Events are ordered by `created_at` within a ledger, but may be processed out of order across ledgers.
4. **Monitoring** - Track the `outbox_events` table size. If it grows unbounded, events aren't being processed fast enough.
