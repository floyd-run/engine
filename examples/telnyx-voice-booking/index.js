/**
 * Telnyx Voice + SMS Booking Integration with Floyd
 *
 * This server demonstrates a complete voice booking flow:
 * 1. Inbound voice call -> collect date preference via DTMF
 * 2. Check Floyd availability -> create hold
 * 3. Send SMS confirmation request
 * 4. Handle inbound SMS reply -> confirm/cancel booking
 *
 * Run: node index.js
 */

const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Configuration
const TELNYX_API_BASE = process.env.TELNYX_API_BASE || 'https://api.telnyx.com/v2';
const TELNYX_API_KEY = process.env.TELNYX_API_KEY;
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY;
const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER;

const FLOYD_API_BASE = process.env.FLOYD_API_BASE || 'https://api.floyd.run';
const FLOYD_API_KEY = process.env.FLOYD_API_KEY;
const SERVICE_ID = process.env.FLOYD_SERVICE_ID;

const HOLD_TTL_MS = 5 * 60 * 1000;

// In-memory store for active booking sessions (use Redis in production)
const bookingSessions = new Map();

// Preserve raw body for webhook verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  }),
);

function decodeClientState(clientState) {
  if (!clientState) return {};
  try {
    return JSON.parse(Buffer.from(clientState, 'base64').toString('utf8'));
  } catch {
    return {};
  }
}

function encodeClientState(data) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

function extractEvent(req) {
  const event = req.body?.data || {};
  return {
    eventType: event.event_type,
    id: event.id,
    occurredAt: event.occurred_at,
    payload: event.payload || {},
  };
}

function normalizePhoneNumber(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.phone_number || value.e164 || null;
}

function extractSmsPayload(req) {
  const payload = req.body?.data?.payload || {};
  const from = normalizePhoneNumber(payload.from) || payload.from?.phone_number || null;
  const text = payload.text || payload.body || payload.message || '';
  const messageId = payload.id || payload.message_id || req.body?.data?.id || null;
  return { from, text, messageId };
}

function verifyTelnyxSignature(req) {
  const signature = req.headers['telnyx-signature-ed25519'];
  const timestamp = req.headers['telnyx-timestamp'];

  if (!signature || !timestamp) return false;
  if (!TELNYX_PUBLIC_KEY) return true;

  try {
    const message = `${timestamp}|${req.rawBody || ''}`;
    const signatureBuffer = Buffer.from(signature, 'base64');
    const publicKeyBuffer = Buffer.from(TELNYX_PUBLIC_KEY, 'base64');

    return crypto.verify(
      null,
      Buffer.from(message),
      { key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), publicKeyBuffer]), format: 'der', type: 'spki' },
      signatureBuffer,
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return false;
  }
}

const telnyxAuth = (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  if (!verifyTelnyxSignature(req)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  return next();
};

async function telnyxRequest(method, endpoint, data = null) {
  const response = await axios({
    method,
    url: `${TELNYX_API_BASE}${endpoint}`,
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data,
  });

  return response.data;
}

async function callControlAction(callControlId, action, payload = {}) {
  return telnyxRequest('POST', `/calls/${callControlId}/actions/${action}`, payload);
}

async function sendSms(to, text) {
  return telnyxRequest('POST', '/messages', {
    from: TELNYX_PHONE_NUMBER,
    to,
    text,
  });
}

async function floydRequest(method, endpoint, data = null) {
  const response = await axios({
    method,
    url: `${FLOYD_API_BASE}${endpoint}`,
    headers: {
      Authorization: `Bearer ${FLOYD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data,
  });

  return response.data;
}

function generateConfirmationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function checkAvailability(dateStr) {
  try {
    const startDate = new Date(dateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const response = await floydRequest('POST', `/v1/services/${SERVICE_ID}/availability/slots`, {
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: 30,
    });

    return response.data?.slots || [];
  } catch (error) {
    console.error('Availability check failed:', error.response?.data || error.message);
    return [];
  }
}

async function createHold(slot) {
  const response = await floydRequest('POST', '/v1/bookings', {
    serviceId: SERVICE_ID,
    slotId: slot.id,
  });
  return response.data;
}

async function confirmBooking(bookingId) {
  const response = await floydRequest('POST', `/v1/bookings/${bookingId}/confirm`, {});
  return response.data;
}

async function cancelBooking(bookingId) {
  const response = await floydRequest('POST', `/v1/bookings/${bookingId}/cancel`, {});
  return response.data;
}

function formatSlotTime(slot) {
  const start = new Date(slot.startTime);
  return start.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDateFromDigit(digit) {
  const date = new Date();
  if (digit === '2') {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

async function promptForDate(callControlId) {
  await callControlAction(callControlId, 'answer');
  await callControlAction(callControlId, 'gather_using_speak', {
    payload: 'Welcome to our booking service. Press 1 for today, or press 2 for tomorrow.',
    valid_digits: '12',
    max: 1,
    timeout_millis: 10000,
    voice: 'female',
    client_state: encodeClientState({ stage: 'date' }),
  });
}

async function promptForSlot(callControlId, sessionId, slot, isNext = false) {
  const intro = isNext ? 'Your next available option is' : 'I found availability.';
  await callControlAction(callControlId, 'gather_using_speak', {
    payload: `${intro} ${formatSlotTime(slot)}. Press 1 to book this time, or press 2 for the next available time.`,
    valid_digits: '12',
    max: 1,
    timeout_millis: 10000,
    voice: 'female',
    client_state: encodeClientState({ stage: 'slot', sessionId }),
  });
}

async function speakMessage(callControlId, message) {
  await callControlAction(callControlId, 'speak', {
    payload: message,
    voice: 'female',
  });
}

app.post('/webhook/inbound-call', telnyxAuth, async (req, res) => {
  const event = extractEvent(req);
  const payload = event.payload;

  try {
    if (event.eventType === 'call.initiated') {
      console.log(`Incoming call: ${payload.call_control_id}`);
      await promptForDate(payload.call_control_id);
    }

    if (event.eventType === 'call.dtmf.received') {
      const callControlId = payload.call_control_id;
      const digit = payload.digits;
      const state = decodeClientState(payload.client_state);

      if (state.stage === 'date') {
        const dateStr = getDateFromDigit(digit);
        const slots = await checkAvailability(dateStr);

        if (slots.length === 0) {
          await speakMessage(callControlId, 'Sorry, no slots are available for that day. Please try again later.');
          await callControlAction(callControlId, 'hangup');
          return res.sendStatus(200);
        }

        const sessionId = generateConfirmationCode();
        bookingSessions.set(sessionId, {
          callControlId,
          phoneNumber: normalizePhoneNumber(payload.from),
          date: dateStr,
          slots,
          currentSlotIndex: 0,
          bookingId: null,
          createdAt: Date.now(),
        });

        await promptForSlot(callControlId, sessionId, slots[0]);
      }

      if (state.stage === 'slot') {
        const session = bookingSessions.get(state.sessionId);

        if (!session) {
          await speakMessage(callControlId, 'Your session has expired. Please call back and try again.');
          await callControlAction(callControlId, 'hangup');
          return res.sendStatus(200);
        }

        if (digit === '2' && session.currentSlotIndex < session.slots.length - 1) {
          session.currentSlotIndex += 1;
          const slot = session.slots[session.currentSlotIndex];
          await promptForSlot(callControlId, state.sessionId, slot, true);
          return res.sendStatus(200);
        }

        const slot = session.slots[session.currentSlotIndex];
        const hold = await createHold(slot);

        session.bookingId = hold.id;
        session.slot = slot;

        if (!session.phoneNumber) {
          await speakMessage(callControlId, 'I could not identify your phone number for SMS confirmation. Please call back.');
          await callControlAction(callControlId, 'hangup');
          return res.sendStatus(200);
        }

        await sendSms(
          session.phoneNumber,
          `Your appointment is ready for ${formatSlotTime(slot)}. Reply YES to confirm, or NO to cancel. This hold expires in 5 minutes.`,
        );

        await speakMessage(callControlId, 'I sent a confirmation text to your phone. Reply yes to confirm or no to cancel. Thank you for calling.');
        await callControlAction(callControlId, 'hangup');
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Call control webhook failed:', error.response?.data || error.message);
    return res.sendStatus(200);
  }
});

app.post('/webhook/sms-inbound', telnyxAuth, async (req, res) => {
  const eventType = req.body?.data?.event_type;
  if (eventType !== 'message.received') {
    return res.sendStatus(200);
  }

  const { from, text } = extractSmsPayload(req);
  const response = text.trim().toLowerCase();

  try {
    let session = null;
    let sessionId = null;

    for (const [id, candidate] of bookingSessions.entries()) {
      if (candidate.phoneNumber === from && candidate.bookingId) {
        session = candidate;
        sessionId = id;
        break;
      }
    }

    if (!session) {
      return res.sendStatus(200);
    }

    if (Date.now() - session.createdAt > HOLD_TTL_MS) {
      bookingSessions.delete(sessionId);
      await sendSms(from, 'Your session has expired. Please call back to start a new booking.');
      return res.sendStatus(200);
    }

    if (response === 'yes' || response === 'confirm') {
      await confirmBooking(session.bookingId);
      await sendSms(from, `Your booking is confirmed. Appointment: ${formatSlotTime(session.slot)}.`);
      bookingSessions.delete(sessionId);
      return res.sendStatus(200);
    }

    if (response === 'no' || response === 'cancel') {
      await cancelBooking(session.bookingId);
      await sendSms(from, 'Your booking has been cancelled.');
      bookingSessions.delete(sessionId);
      return res.sendStatus(200);
    }

    await sendSms(from, 'Reply YES to confirm your booking, or NO to cancel.');
    return res.sendStatus(200);
  } catch (error) {
    console.error('SMS webhook failed:', error.response?.data || error.message);
    return res.sendStatus(200);
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Telnyx Floyd Booking Server running on port ${PORT}`);
  console.log(`Telnyx API: ${TELNYX_API_BASE}`);
  console.log(`Floyd API: ${FLOYD_API_BASE}`);
  console.log(`Service ID: ${SERVICE_ID}`);
});
