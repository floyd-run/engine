# Add Telnyx Voice + SMS Booking Example

## Summary

This PR adds a production-ready example demonstrating how to integrate Telnyx Voice and SMS APIs with Floyd for phone-based appointment booking. It showcases the full two-phase booking lifecycle (hold, confirm, cancel) through an intuitive voice + SMS flow.

## What This Example Demonstrates

- **Inbound Voice Handling**: IVR system that greets callers and collects their preferred appointment date
- **Availability Integration**: Real-time queries to Floyd's availability API to present open slots
- **Two-Phase Booking**: Creates holds, sends SMS confirmation requests, and confirms/cancels based on user response
- **SMS Workflow**: Complete inbound/outbound SMS handling for the confirmation step
- **Session Management**: Tracks active booking sessions (with notes on production-grade alternatives)

## Why This Matters

Floyd's hold-then-confirm model is ideal for async workflows, but demonstrating it end-to-end with real communication channels helps developers understand the practical implementation. This example shows:

1. **How to structure a voice booking flow** around Floyd's API
2. **How the two-phase model enables human-in-the-loop confirmation** (SMS reply)
3. **How to handle concurrent booking attempts safely** (Floyd handles this, but the pattern is important)

## Use Case

A small business (hair salon, dental office, consulting firm) wants to let customers book appointments by phone. They need:

- Voice interface for accessibility (no app required)
- SMS confirmation for accountability (written record)
- No double bookings (handled by Floyd)
- Simple integration (this example provides a template)

## Files Added

```
examples/telnyx-voice-booking/
  index.js        # Express server with webhook handlers
  README.md       # Setup guide and architecture diagram
  .env.example    # Environment variable template
  package.json    # Dependencies
```

## Dependencies

- `express` - Web server
- `telnyx` - Official Telnyx Node SDK
- `axios` - HTTP client for Floyd API
- `dotenv` - Environment management

All are lightweight, well-maintained packages.

## Testing

1. Set up a Telnyx account and phone number
2. Create a Floyd service with resources and a policy
3. Configure environment variables
4. Run `node index.js`
5. Call the Telnyx number and follow the prompts

## Documentation Quality

The README includes:
- ASCII architecture diagram showing the complete flow
- Step-by-step setup instructions
- Environment variable reference table
- Production considerations (Redis, webhook security, rate limiting)
- Troubleshooting section
- Floyd integration details explaining the two-phase model

## Complementary to Existing Examples

This complements the Vapi tutorial in the Floyd docs by showing a code-first integration rather than a no-code dashboard approach. Developers who prefer to own their infrastructure can use this as a starting point.

## Future Enhancements (Out of Scope)

- Multi-language support
- Timezone detection from caller area code
- Calendar sync for confirmed bookings
- Retry logic for failed SMS delivery

---

This example lowers the barrier to building production voice booking systems with Floyd. It's focused, documented, and ready to run with minimal configuration.