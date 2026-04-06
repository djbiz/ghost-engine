#!/usr/bin/env node
/**
 * Ghost Engine — Webhook Configuration System
 * Supports: lead_created, lead_updated, score_changed, crm_sync_complete
 */

const crypto = require("crypto");
const axios = require("axios");

const EVENT_TYPES = ["lead_created", "lead_updated", "score_changed", "crm_sync_complete"];

const DEFAULT_CONFIG = {
  secretKey: process.env.WEBHOOK_SECRET_KEY || "",
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 30000
};

class WebhookManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.endpoints = new Map();
    this.eventHandlers = new Map();
    this.deliveryLog = [];
  }

  registerEndpoint(name, url, events = EVENT_TYPES, options = {}) {
    if (!name || !url) {
      throw new Error("Webhook name and URL are required");
    }
    if (!this.isValidUrl(url)) {
      throw new Error("Invalid webhook URL");
    }
    const validEvents = events.filter(e => EVENT_TYPES.includes(e));
    if (validEvents.length === 0) {
      throw new Error("At least one valid event type is required");
    }
    this.endpoints.set(name, {
      url,
      events: validEvents,
      enabled: options.enabled !== false,
      secret: options.secret || this.config.secretKey,
      timeout: options.timeout || this.config.timeout
    });
    return this;
  }

  unregisterEndpoint(name) {
    return this.endpoints.delete(name);
  }

  getEndpoint(name) {
    return this.endpoints.get(name);
  }

  listEndpoints() {
    const endpoints = [];
    for (const [name, endpoint] of this.endpoints) {
      endpoints.push({ name, ...endpoint });
    }
    return endpoints;
  }

  registerEventHandler(eventType, handler) {
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    if (typeof handler !== "function") {
      throw new Error("Handler must be a function");
    }
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
    return this;
  }

  on(eventType, handler) {
    return this.registerEventHandler(eventType, handler);
  }

  async emit(eventType, data) {
    if (!EVENT_TYPES.includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    const handlers = this.eventHandlers.get(eventType) || [];
    const results = [];
    for (const handler of handlers) {
      try {
        results.push(await handler(data));
      } catch (error) {
        results.push({ error: error.message });
      }
    }
    return results;
  }

  generateSignature(payload, secret) {
    return crypto
      .createHmac("sha256", secret)
      .update(typeof payload === "string" ? payload : JSON.stringify(payload))
      .digest("hex");
  }

  verifySignature(payload, signature, secret) {
    const expected = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  createSignedPayload(data, eventType) {
    const payload = {
      event: eventType,
      timestamp: Date.now(),
      data
    };
    const signature = this.generateSignature(payload, this.config.secretKey);
    return { payload, signature };
  }

  async deliver(name, eventType, data) {
    const endpoint = this.endpoints.get(name);
    if (!endpoint) {
      throw new Error(`Webhook endpoint not found: ${name}`);
    }
    if (!endpoint.events.includes(eventType)) {
      throw new Error(`Event ${eventType} not registered for endpoint ${name}`);
    }
    if (!endpoint.enabled) {
      return { success: false, reason: "Endpoint disabled" };
    }
    const { payload, signature } = this.createSignedPayload(data, eventType);
    const deliveryAttempt = {
      endpoint: name,
      event: eventType,
      timestamp: Date.now(),
      attempts: 0,
      success: false
    };
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      deliveryAttempt.attempts = attempt;
      try {
        const response = await axios.post(endpoint.url, payload, {
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event": eventType,
            "X-Webhook-Timestamp": payload.timestamp
          },
          timeout: endpoint.timeout
        });
        deliveryAttempt.success = true;
        deliveryAttempt.response = { status: response.status, data: response.data };
        break;
      } catch (error) {
        deliveryAttempt.error = error.message;
        deliveryAttempt.statusCode = error.response?.status;
        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }
    this.deliveryLog.push(deliveryAttempt);
    return deliveryAttempt;
  }

  async broadcast(eventType, data) {
    const results = [];
    for (const [name, endpoint] of this.endpoints) {
      if (endpoint.events.includes(eventType) && endpoint.enabled) {
        results.push({ endpoint: name, ...await this.deliver(name, eventType, data) });
      }
    }
    return results;
  }

  getDeliveryLog(limit = 100) {
    return this.deliveryLog.slice(-limit);
  }

  clearDeliveryLog() {
    this.deliveryLog = [];
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getEventTypes() {
    return [...EVENT_TYPES];
  }

  enableEndpoint(name) {
    const endpoint = this.endpoints.get(name);
    if (endpoint) {
      endpoint.enabled = true;
    }
    return this;
  }

  disableEndpoint(name) {
    const endpoint = this.endpoints.get(name);
    if (endpoint) {
      endpoint.enabled = false;
    }
    return this;
  }
}

function createWebhookManager(config) {
  return new WebhookManager(config);
}

function verifyWebhookSignature(payload, signature, secret) {
  const manager = new WebhookManager({ secretKey: secret });
  return manager.verifySignature(payload, signature, secret);
}

module.exports = {
  WebhookManager,
  createWebhookManager,
  verifyWebhookSignature,
  EVENT_TYPES
};

if (require.main === module) {
  const manager = new WebhookManager();

  manager.registerEndpoint("lead-capture", "https://api.example.com/webhooks/leads", ["lead_created", "lead_updated"]);
  manager.registerEndpoint("crm-sync", "https://crm.example.com/webhooks/sync", ["crm_sync_complete"]);

  console.log("Registered endpoints:", manager.listEndpoints());

  manager.on("lead_created", async (data) => {
    console.log("Lead created:", data.email);
    return { processed: true };
  });

  manager.on("score_changed", async (data) => {
    console.log("Score changed for:", data.email, "New score:", data.score);
    return { processed: true };
  });

  console.log("Available event types:", manager.getEventTypes());
}