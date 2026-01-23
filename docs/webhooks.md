# Webhooks

Floyd sends webhook notifications when allocation events occur. Subscribe to receive real-time updates about your allocations.

## Events

| Event                  | Description                  |
| ---------------------- | ---------------------------- |
| `allocation.created`   | A new allocation was created |
| `allocation.confirmed` | A hold was confirmed         |
| `allocation.cancelled` | An allocation was cancelled  |
| `allocation.expired`   | A hold expired               |

## Payload format

```json
{
  "id": "whd_01abc123...",
  "type": "allocation.created",
  "ledgerId": "ldg_01xyz789...",
  "createdAt": "2024-01-15T10:00:00Z",
  "data": {
    "allocation": {
      "id": "alc_01def456...",
      "ledgerId": "ldg_01xyz789...",
      "resourceId": "rsc_01ghi789...",
      "status": "hold",
      "startAt": "2024-01-15T14:00:00Z",
      "endAt": "2024-01-15T15:00:00Z",
      "expiresAt": "2024-01-15T10:15:00Z",
      "metadata": null,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

## Headers

| Header            | Description                            |
| ----------------- | -------------------------------------- |
| `Floyd-Signature` | HMAC-SHA256 signature for verification |
| `Content-Type`    | `application/json`                     |

## Verifying signatures

Verify the `Floyd-Signature` header to ensure the request is from Floyd:

```javascript
import { createHmac } from "crypto";

function verifySignature(payload, signature, secret) {
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

// In your handler
app.post("/webhook", (req, res) => {
  const signature = req.headers["floyd-signature"];
  const payload = JSON.stringify(req.body);

  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send("Invalid signature");
  }

  // Process the event
  const event = req.body;
  console.log(`Received ${event.type} for allocation ${event.data.allocation.id}`);

  res.status(200).send("OK");
});
```

## Retry behavior

Failed deliveries are retried with exponential backoff:

| Attempt | Delay      |
| ------- | ---------- |
| 1       | 1 minute   |
| 2       | 5 minutes  |
| 3       | 30 minutes |
| 4       | 2 hours    |
| 5       | 12 hours   |

After 5 failed attempts, the delivery is marked as exhausted.

## Best practices

1. **Respond quickly** - Return a 2xx status within 30 seconds
2. **Process asynchronously** - Queue the event and process later
3. **Handle duplicates** - Use the event `id` for idempotency
4. **Verify signatures** - Always validate the `Floyd-Signature` header
