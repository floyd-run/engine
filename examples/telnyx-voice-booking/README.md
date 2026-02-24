# Telnyx Voice + SMS Booking Integration

A production-ready example showing how to integrate Telnyx Voice and SMS with the Floyd booking engine. This demonstrates the complete booking flow from inbound voice call to SMS confirmation.

## Architecture

```
+------------------+     +-------------------+     +------------------+
|   Caller         |     |   This Server     |     |   Floyd API      |
|   (Phone)        |     |   (Express)       |     |   (Booking)      |
+--------+---------+     +--------+----------+     +--------+---------+
         |                        |                        |
         | 1. Inbound call        |                        |
         |----------------------->|                        |
         |                        |                        |
         | 2. IVR: "What date?"   |                        |
         |<-----------------------|                        |
         |                        |                        |
         | 3. Speech/DTMF input   |                        |
         |----------------------->|                        |
         |                        | 4. Check availability  |
         |                        |----------------------->|
         |                        |                        |
         |                        | 5. Available slots     |
         |                        |<-----------------------|
         |                        |                        |
         | 6. IVR: "Option 1: X"  |                        |
         |<-----------------------|                        |
         |                        |                        |
         | 7. Selection           |                        |
         |----------------------->|                        |
         |                        |                        |
         |                        | 8. Create hold         |
         |                        |----------------------->|
         |                        |                        |
         |                        | 9. Hold confirmed      |
         |                        |<-----------------------|
         |                        |                        |
         | 10. Call ends          |                        |
         |<---------------------->|                        |
         |                        |                        |
         | 11. SMS: "Reply YES"   |                        |
         |<-----------------------|                        |
         |                        |                        |
         | 12. SMS: "YES"         |                        |
         |----------------------->|                        |
         |                        |                        |
         |                        | 13. Confirm booking    |
         |                        |----------------------->|
         |                        |                        |
         | 14. SMS: "Confirmed!"  |                        |
         |<-----------------------|                        |
         |                        |                        |
         v                        v                        v
```

## Flow

1. **Inbound Call**: Customer calls your Telnyx phone number
2. **IVR Greeting**: Server answers and asks caller to choose date via DTMF
3. **Availability Check**: Server queries Floyd API for available slots
4. **Slot Presentation**: Caller hears available times and selects one
5. **Hold Creation**: Server creates a hold in Floyd (blocks the slot)
6. **SMS Confirmation**: Server sends SMS asking caller to confirm
7. **SMS Reply**: Caller replies "YES" or "NO"
8. **Finalize**: Server confirms or cancels the booking in Floyd

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Telnyx account](https://telnyx.com) with:
  - API Key (from the Portal)
  - A phone number with Voice and SMS enabled
  - Public webhook endpoint (see [Ngrok setup](#testing-with-ngrok))
- A [Floyd Console](https://console.floyd.run) account with:
  - API Key
  - A Service configured with resources and a policy

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/floyd-run/engine.git
cd engine/examples/telnyx-voice-booking
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Telnyx Configuration
TELNYX_API_KEY=your_telnyx_api_key
TELNYX_PUBLIC_KEY=your_telnyx_webhook_public_key
TELNYX_PHONE_NUMBER=+15551234567

# Floyd Configuration
FLOYD_API_KEY=floyd_live_your_key_here
FLOYD_SERVICE_ID=svc_your_service_id
FLOYD_API_BASE=https://api.floyd.run

# Server
PORT=3000
NODE_ENV=development
```

### 3. Run the Server

```bash
node index.js
```

### 4. Configure Telnyx Webhooks

In the [Telnyx Portal](https://portal.telnyx.com):

1. Go to **Call Control** > **Applications**
2. Create or edit an application
3. Set the webhook URL to: `https://your-domain.com/webhook/inbound-call` (this receives all Call Control events)
4. Go to **Messaging** > **Messaging Profiles**
5. Create or edit a profile
6. Set the inbound webhook URL to: `https://your-domain.com/webhook/sms-inbound`
7. Assign your phone number to both profiles

### 5. Test

Call your Telnyx phone number and follow the prompts!

## Testing with Ngrok

For local development, use [ngrok](https://ngrok.com) to expose your server:

```bash
# Terminal 1: Start the server
node index.js

# Terminal 2: Start ngrok
ngrok http 3000
```

Use the ngrok URL (e.g., `https://abc123.ngrok.io`) as your webhook base URL in Telnyx.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/inbound-call` | POST | Handle Call Control events (`call.initiated`, `call.dtmf.received`) |
| `/webhook/sms-inbound` | POST | Handle SMS replies |
| `/health` | GET | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TELNYX_API_KEY` | Yes | Your Telnyx API key |
| `TELNYX_PUBLIC_KEY` | Production | Telnyx webhook signing public key (base64) |
| `TELNYX_PHONE_NUMBER` | Yes | Your Telnyx phone number (E.164 format) |
| `FLOYD_API_KEY` | Yes | Your Floyd API key |
| `FLOYD_SERVICE_ID` | Yes | The Floyd service ID to book against |
| `FLOYD_API_BASE` | No | Floyd API base URL (default: `https://api.floyd.run`) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Environment (production enables webhook signature validation) |

## Production Considerations

### Session Storage

This example uses an in-memory `Map` for booking sessions. In production, use:

- **Redis**: Fast, with TTL support for auto-expiration
- **Database**: PostgreSQL with a `booking_sessions` table

```javascript
// Example with Redis
const redis = require('redis');
const client = redis.createClient();

await client.setEx(`session:${sessionId}`, 300, JSON.stringify(session));
```

### Webhook Security

In production, Telnyx signs webhooks. Enable verification:

```javascript
const crypto = require('crypto');

function verifyTelnyxSignature(req) {
  const timestamp = req.headers['telnyx-timestamp'];
  const signature = req.headers['telnyx-signature-ed25519'];
  // Verify using Telnyx public key
}
```

### Error Handling

Add proper error handling and logging:

```javascript
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  transports: [new winston.transports.Console()],
});
```

### Rate Limiting

Protect your endpoints from abuse:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);
```

## Floyd Integration Details

### Two-Phase Booking

Floyd uses a hold-then-confirm model that prevents double bookings:

1. **Hold**: Reserves a slot with a TTL (typically 5-10 minutes)
2. **Confirm**: Finalizes the booking when the user confirms
3. **Cancel/Expire**: Releases the slot if the user declines or TTL passes

This is perfect for async workflows like SMS confirmation where the user needs time to respond.

### Availability Queries

Floyd returns available slots based on:
- Service configuration (duration, resources)
- Policy rules (working hours, buffers)
- Existing bookings (conflict detection)

```javascript
// Query slots for a specific date
const slots = await floydRequest('POST', `/v1/services/${SERVICE_ID}/availability/slots`, {
  startTime: '2025-01-15T00:00:00Z',
  endTime: '2025-01-15T23:59:59Z',
  durationMinutes: 30,
});
```

### Idempotency

For retry-safe operations, include an idempotency key:

```javascript
const response = await axios.post(url, data, {
  headers: {
    'Authorization': `Bearer ${FLOYD_API_KEY}`,
    'Idempotency-Key': `booking-${callId}-${slotId}`,
  },
});
```

## Troubleshooting

### No Available Slots

- Check that your Floyd service has resources configured
- Verify the policy has working hours defined
- Ensure the date queried is within the lead time window

### SMS Not Received

- Verify the phone number is in E.164 format (+15551234567)
- Check Telnyx messaging profile settings
- Review Telnyx logs for delivery status

### Webhook Not Received

- Ensure your server is publicly accessible
- Check Telnyx webhook URL configuration
- Verify the Content-Type header is correct

## License

Apache 2.0

## Contributing

Contributions welcome! This example is part of the [Floyd Engine](https://github.com/floyd-run/engine) repository.
