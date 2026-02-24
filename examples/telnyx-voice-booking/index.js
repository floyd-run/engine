/**
 * Telnyx Voice + SMS Booking Integration with Floyd
 * 
 * This server demonstrates a complete voice booking flow:
 * 1. Inbound voice call → IVR collects date/time preference
 * 2. Check Floyd availability → create hold
 * 3. Send SMS with confirmation link
 * 4. Handle SMS reply "yes" → confirm booking
 * 
 * Run: node index.js
 */

const express = require('express');
const { Telnyx } = require('telnyx');
const axios = require('axios');
require('dotenv').config();

const app = express();
const telnyx = new Telnyx(process.env.TELNYX_API_KEY);

// Configuration
const FLOYD_API_BASE = process.env.FLOYD_API_BASE || 'https://api.floyd.run';
const FLOYD_API_KEY = process.env.FLOYD_API_KEY;
const SERVICE_ID = process.env.FLOYD_SERVICE_ID;
const CALL_TIMEOUT_MS = 30000;

// In-memory store for active booking sessions (use Redis in production)
const bookingSessions = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Telnyx webhook authentication
const telnyxAuth = (req, res, next) => {
  const signature = req.headers['telnyx-signature'];
  if (!signature && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Missing signature' });
  }
  next();
};

/**
 * Call Floyd API with proper headers
 */
async function floydRequest(method, endpoint, data = null) {
  const url = `${FLOYD_API_BASE}${endpoint}`;
  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${FLOYD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data,
  };
  const response = await axios(config);
  return response.data;
}

/**
 * Generate a confirmation code for SMS
 */
function generateConfirmationCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/**
 * Check availability for a given date
 */
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

/**
 * Create a hold on Floyd
 */
async function createHold(slot) {
  try {
    const response = await floydRequest('POST', '/v1/bookings', {
      serviceId: SERVICE_ID,
      slotId: slot.id,
    });
    return response.data;
  } catch (error) {
    console.error('Hold creation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Confirm a booking
 */
async function confirmBooking(bookingId) {
  try {
    const response = await floydRequest('POST', `/v1/bookings/${bookingId}/confirm`, {});
    return response.data;
  } catch (error) {
    console.error('Confirmation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Cancel a booking
 */
async function cancelBooking(bookingId) {
  try {
    const response = await floydRequest('POST', `/v1/bookings/${bookingId}/cancel`, {});
    return response.data;
  } catch (error) {
    console.error('Cancellation failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Parse date from speech/input
 */
function parseDateFromInput(input) {
  const today = new Date();
  const lower = input.toLowerCase();
  
  if (lower.includes('tomorrow')) {
    today.setDate(today.getDate() + 1);
  } else if (lower.includes('today')) {
    // already today
  } else {
    // Try to parse specific date
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  }
  
  return today.toISOString().split('T')[0];
}

/**
 * Format slot time for display
 */
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

/**
 * Generate Telnyx IVR XML response
 */
function generateIvrResponse(gatherResult = null) {
  let response = '<?xml version="1.0" encoding="UTF-8"?><Response>';
  
  if (gatherResult) {
    response += `<Say voice="female">Thank you. Let me check availability for ${gatherResult}. One moment please.</Say>`;
  } else {
    response += `<Say voice="female">Welcome to our booking service. What date would you like to book an appointment?</Say>`;
    response += '<Gather numDigits="10" action="/webhook/gather-date" method="POST" timeout="10">';
    response += '<Say voice="female">Please say or enter the date, for example, tomorrow, or January 15th.</Say>';
    response += '</Gather>';
  }
  
  response += '</Response>';
  return response;
}

/**
 * Generate confirmation message with link
 */
function generateConfirmationMessage(booking, slot) {
  const formattedTime = formatSlotTime(slot);
  return `Your appointment is ready for ${formattedTime}. 
Reply YES to confirm, or NO to cancel.
This hold expires in 5 minutes.`;
}

// ========== WEBHOOK HANDLERS ==========

/**
 * Handle inbound call
 */
app.post('/webhook/inbound-call', telnyxAuth, async (req, res) => {
  const { call_id, from } = req.body;
  
  console.log(`Incoming call from ${from}, call_id: ${call_id}`);
  
  res.type('text/xml');
  res.send(generateIvrResponse());
});

/**
 * Handle date gather
 */
app.post('/webhook/gather-date', telnyxAuth, async (req, res) => {
  const { call_id, from, digits, speech } = req.body;
  const input = digits || speech?.results?.[0]?.transcript;
  const dateStr = parseDateFromInput(input || '');
  
  console.log(`Call ${call_id}: User wants date ${dateStr}`);
  
  // Check availability
  const slots = await checkAvailability(dateStr);
  
  if (slots.length === 0) {
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">Sorry, no slots available for that date. Please call back or try a different date.</Say>
  <Hangup/>
</Response>`);
    return;
  }
  
  // Store session
  const sessionId = generateConfirmationCode();
  bookingSessions.set(sessionId, {
    callId: call_id,
    phoneNumber: from,
    date: dateStr,
    slots,
    currentSlotIndex: 0,
    bookingId: null,
    createdAt: Date.now(),
  });
  
  // Present first available slot
  const slot = slots[0];
  const formattedTime = formatSlotTime(slot);
  
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">I found available times. Your first option is ${formattedTime}. Say yes to book this time, or say next for another option.</Say>
  <Gather numDigits="1" action="/webhook/gather-time?session=${sessionId}" method="POST" timeout="5">
    <Say voice="female">Press 1 to book this time, or press 2 for the next available time.</Say>
  </Gather>
</Response>`);
});

/**
 * Handle time selection
 */
app.post('/webhook/gather-time', telnyxAuth, async (req, res) => {
  const { call_id, digits, session: sessionId } = req.body;
  const session = bookingSessions.get(sessionId);
  
  if (!session) {
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">Sorry, your session has expired. Please call back.</Say>
  <Hangup/>
</Response>`);
    return;
  }
  
  const choice = parseInt(digits, 10);
  
  if (choice === 2 && session.currentSlotIndex < session.slots.length - 1) {
    // Move to next slot
    session.currentSlotIndex++;
    const slot = session.slots[session.currentSlotIndex];
    const formattedTime = formatSlotTime(slot);
    
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">Your next option is ${formattedTime}. Press 1 to book this time, or press 2 for the next available time.</Say>
  <Gather numDigits="1" action="/webhook/gather-time?session=${sessionId}" method="POST" timeout="5"/>
</Response>`);
    return;
  }
  
  // Create hold on selected slot
  const slot = session.slots[session.currentSlotIndex];
  
  try {
    const hold = await createHold(slot);
    session.bookingId = hold.id;
    session.slot = slot;
    
    console.log(`Call ${call_id}: Created hold ${hold.id} for slot ${slot.id}`);
    
    // Send SMS with confirmation request
    const message = generateConfirmationMessage(hold, slot);
    
    await telnyx.messages.create({
      from: process.env.TELNYX_PHONE_NUMBER,
      to: session.phoneNumber,
      text: message,
    });
    
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">I've reserved your slot and sent a confirmation text to your phone. Reply yes to confirm, or no to cancel. Thank you for calling.</Say>
  <Hangup/>
</Response>`);
  } catch (error) {
    console.error('Failed to create hold:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="female">Sorry, that slot is no longer available. Please call back to try again.</Say>
  <Hangup/>
</Response>`);
  }
});

/**
 * Handle SMS inbound (confirmation)
 */
app.post('/webhook/sms-inbound', telnyxAuth, async (req, res) => {
  const { from, text, message_id } = req.body;
  const response = text?.trim().toLowerCase();
  
  console.log(`SMS from ${from}: ${text}`);
  
  // Find session by phone number
  let session = null;
  for (const [id, sess] of bookingSessions.entries()) {
    if (sess.phoneNumber === from && sess.bookingId) {
      session = sess;
      session.sessionId = id;
      break;
    }
  }
  
  if (!session) {
    console.log('No active session found for', from);
    res.sendStatus(200);
    return;
  }
  
  // Check for expired sessions
  if (Date.now() - session.createdAt > CALL_TIMEOUT_MS) {
    bookingSessions.delete(session.sessionId);
    await telnyx.messages.create({
      from: process.env.TELNYX_PHONE_NUMBER,
      to: from,
      text: 'Your session has expired. Please call back to start a new booking.',
    });
    res.sendStatus(200);
    return;
  }
  
  if (response === 'yes' || response === 'confirm') {
    try {
      await confirmBooking(session.bookingId);
      
      await telnyx.messages.create({
        from: process.env.TELNYX_PHONE_NUMBER,
        to: from,
        text: `Your booking is confirmed! Appointment: ${formatSlotTime(session.slot)}. Thank you!`,
      });
      
      console.log(`Booking ${session.bookingId} confirmed via SMS`);
      bookingSessions.delete(session.sessionId);
    } catch (error) {
      console.error('Confirmation failed:', error);
      await telnyx.messages.create({
        from: process.env.TELNYX_PHONE_NUMBER,
        to: from,
        text: 'Confirmation failed. Please call back to try again.',
      });
    }
  } else if (response === 'no' || response === 'cancel') {
    try {
      await cancelBooking(session.bookingId);
      
      await telnyx.messages.create({
        from: process.env.TELNYX_PHONE_NUMBER,
        to: from,
        text: 'Your booking has been cancelled. Thank you!',
      });
      
      console.log(`Booking ${session.bookingId} cancelled via SMS`);
      bookingSessions.delete(session.sessionId);
    } catch (error) {
      console.error('Cancellation failed:', error);
    }
  }
  
  res.sendStatus(200);
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Telnyx Floyd Booking Server running on port ${PORT}`);
  console.log(`Floyd API: ${FLOYD_API_BASE}`);
  console.log(`Service ID: ${SERVICE_ID}`);
});