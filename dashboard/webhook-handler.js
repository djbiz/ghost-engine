'use strict';
/**
 * Ghost Engine - Zo Webhook Handler
 * Stripe webhook receiver and event API server
 * Reference: LEG-39
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'webhook-events.json');
const MAX_MEMORY_EVENTS = 1000;

/* -- In-memory event store (FIFO, max 1000) -- */
let events = [];

/* -- Ensure data directory exists -- */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

/* -- Load persisted events on startup -- */
function loadPersistedEvents() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      events = parsed.slice(-MAX_MEMORY_EVENTS);
    }
  } catch (err) {
    console.error('[LEG-39] Failed to load persisted events:', err.message);
    events = [];
  }
}

/* -- Persist single event (append-style) -- */
function persistEvent(evt) {
  ensureDataDir();
  try {
    let existing = [];
    try {
      existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!Array.isArray(existing)) existing = [];
    } catch (_) {
      existing = [];
    }
    existing.push(evt);
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), 'utf8');
  } catch (err) {
    console.error('[LEG-39] Failed to persist event:', err.message);
  }
}

/* -- Push event into memory store -- */
function storeEvent(evt) {
  events.push(evt);
  if (events.length > MAX_MEMORY_EVENTS) {
    events = events.slice(events.length - MAX_MEMORY_EVENTS);
  }
  persistEvent(evt);
}

/* -- Stripe signature verification -- */
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) return true;
  const parts = {};
  sigHeader.split(',').forEach(function(item) {
    const kv = item.split('=');
    if (kv[0] === 't') parts.t = kv[1];
    if (kv[0] === 'v1') parts.v1 = kv[1];
  });
  if (!parts.t || !parts.v1) return false;
  const signed = parts.t + '.' + payload;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}

/* -- Extract relevant data from Stripe event -- */
function extractEventData(event) {
  const type = event.type || 'unknown';
  const obj = (event.data && event.data.object) || {};
  const base = {
    id: event.id || 'evt_' + Date.now(),
    type: type,
    created: event.created || Math.floor(Date.now() / 1000),
    livemode: event.livemode || false,
    raw: event
  };

  switch (type) {
    case 'checkout.session.completed':
      base.status = obj.payment_status || obj.status || 'succeeded';
      base.amount = obj.amount_total || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = (obj.customer_details && obj.customer_details.email) || obj.customer_email || '';
      base.product = (obj.metadata && obj.metadata.product_name) || '';
      break;

    case 'payment_intent.succeeded':
      base.status = 'succeeded';
      base.amount = obj.amount || obj.amount_received || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = obj.receipt_email || (obj.charges && obj.charges.data && obj.charges.data[0] && obj.charges.data[0].billing_details && obj.charges.data[0].billing_details.email) || '';
      base.product = (obj.metadata && obj.metadata.product_name) || obj.description || '';
      break;

    case 'payment_intent.payment_failed':
      base.status = 'failed';
      base.amount = obj.amount || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = obj.receipt_email || '';
      base.product = (obj.metadata && obj.metadata.product_name) || obj.description || '';
      base.error_message = (obj.last_payment_error && obj.last_payment_error.message) || '';
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      base.status = obj.status || 'unknown';
      base.amount = (obj.plan && obj.plan.amount) || (obj.items && obj.items.data && obj.items.data[0] && obj.items.data[0].plan && obj.items.data[0].plan.amount) || 0;
      base.currency = (obj.plan && obj.plan.currency) || 'usd';
      base.customer_email = obj.customer_email || '';
      base.product = (obj.plan && obj.plan.nickname) || (obj.plan && obj.plan.id) || '';
      base.subscription_id = obj.id || '';
      break;

    case 'invoice.paid':
      base.status = 'succeeded';
      base.amount = obj.amount_paid || obj.total || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = obj.customer_email || '';
      base.product = (obj.lines && obj.lines.data && obj.lines.data[0] && obj.lines.data[0].description) || '';
      break;

    case 'invoice.payment_failed':
      base.status = 'failed';
      base.amount = obj.amount_due || obj.total || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = obj.customer_email || '';
      base.product = '';
      break;

    case 'charge.refunded':
      base.status = 'refunded';
      base.amount = obj.amount_refunded || obj.amount || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = (obj.billing_details && obj.billing_details.email) || obj.receipt_email || '';
      base.product = obj.description || '';
      break;

    default:
      base.status = obj.status || 'unknown';
      base.amount = obj.amount || 0;
      base.currency = obj.currency || 'usd';
      base.customer_email = '';
      base.product = '';
  }

  return base;
}

/* -- Compute stats from stored events -- */
function computeStats() {
  let successfulPayments = 0;
  let failedPayments = 0;
  let failedRevenue = 0;
  let totalRevenue = 0;
  const activeSubs = new Set();

  events.forEach(function(ev) {
    if (
      ev.type === 'payment_intent.succeeded' ||
      ev.type === 'checkout.session.completed' ||
      ev.type === 'invoice.paid'
    ) {
      successfulPayments++;
      totalRevenue += ev.amount || 0;
    }

    if (ev.type === 'payment_intent.payment_failed' || ev.type === 'invoice.payment_failed') {
      failedPayments++;
      failedRevenue += ev.amount || 0;
    }

    if (ev.type === 'charge.refunded') {
      totalRevenue -= ev.amount || 0;
    }

    if (ev.type === 'customer.subscription.created' || ev.type === 'customer.subscription.updated') {
      if (ev.status === 'active' || ev.status === 'trialing') {
        activeSubs.add(ev.subscription_id || ev.id);
      } else {
        activeSubs.delete(ev.subscription_id || ev.id);
      }
    }
    if (ev.type === 'customer.subscription.deleted') {
      activeSubs.delete(ev.subscription_id || ev.id);
    }
  });

  return {
    totalEvents: events.length,
    successfulPayments: successfulPayments,
    failedPayments: failedPayments,
    failedRevenue: failedRevenue,
    activeSubscriptions: activeSubs.size,
    totalRevenue: totalRevenue
  };
}

/* -- Middleware -- */
app.use(cors());

/* Raw body for webhook signature verification */
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), function(req, res) {
  const sig = req.headers['stripe-signature'] || '';
  const payload = req.body.toString('utf8');

  if (STRIPE_WEBHOOK_SECRET) {
    try {
      const valid = verifyStripeSignature(payload, sig, STRIPE_WEBHOOK_SECRET);
      if (!valid) {
        console.error('[LEG-39] Invalid Stripe webhook signature');
        return res.status(400).json({ error: 'Invalid signature' });
      }
    } catch (err) {
      console.error('[LEG-39] Signature verification error:', err.message);
      return res.status(400).json({ error: 'Signature verification failed' });
    }
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch (err) {
    console.error('[LEG-39] Invalid JSON payload:', err.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const extracted = extractEventData(event);
  storeEvent(extracted);

  console.log('[LEG-39] Received event: %s (%s)', extracted.type, extracted.id);
  res.status(200).json({ received: true, id: extracted.id, type: extracted.type });
});

/* JSON body for other routes */
app.use(express.json());

/* -- GET /api/events -- */
app.get('/api/events', function(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, MAX_MEMORY_EVENTS);
  const typeFilter = req.query.type || null;

  let filtered = events;
  if (typeFilter && typeFilter !== 'all') {
    filtered = events.filter(function(e) { return e.type === typeFilter; });
  }

  const result = filtered.slice(-limit).reverse();
  res.json({ events: result, total: filtered.length, limit: limit });
});

/* -- GET /api/stats -- */
app.get('/api/stats', function(req, res) {
  res.json(computeStats());
});

/* -- GET / -- serve dashboard HTML -- */
app.get('/', function(req, res) {
  const dashboardPath = path.join(__dirname, 'stripe-webhooks.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.redirect('/dashboard');
  }
});

/* -- GET /dashboard -- alternative path -- */
app.get('/dashboard', function(req, res) {
  const dashboardPath = path.join(__dirname, 'stripe-webhooks.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).json({ error: 'Dashboard HTML not found. Place stripe-webhooks.html in the same directory.' });
  }
});

/* -- Health check -- */
app.get('/health', function(req, res) {
  res.json({ status: 'ok', uptime: process.uptime(), events: events.length, ref: 'LEG-39' });
});

/* -- Start server -- */
loadPersistedEvents();
app.listen(PORT, function() {
  console.log('[LEG-39] Zo Webhook Handler running on port %d', PORT);
  console.log('[LEG-39] Dashboard: http://localhost:%d', PORT);
  console.log('[LEG-39] Webhook endpoint: POST http://localhost:%d/webhooks/stripe', PORT);
  console.log('[LEG-39] Events loaded from disk: %d', events.length);
});

module.exports = app;
