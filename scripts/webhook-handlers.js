#!/usr/bin/env node
/**
 * Ghost Engine — Webhook Handlers
 * Example handlers for external events: lead forms, CRM updates, email campaigns
 */

const path = require("path");
const fs = require("fs");
const { WebhookManager, createWebhookManager } = require("../lib/webhooks");

const BASE_DIR = path.join(__dirname, "..");
const LEADS_DIR = path.join(BASE_DIR, "leads");
const CONFIG_DIR = path.join(BASE_DIR, "config");

function loadLeads() {
  const crmPath = path.join(LEADS_DIR, "crm.json");
  if (fs.existsSync(crmPath)) {
    return JSON.parse(fs.readFileSync(crmPath, "utf8"));
  }
  return [];
}

function saveLeads(leads) {
  const crmPath = path.join(LEADS_DIR, "crm.json");
  fs.writeFileSync(crmPath, JSON.stringify(leads, null, 2));
}

function updateLead(leadId, updates) {
  const leads = loadLeads();
  const index = leads.findIndex(l => l.id === leadId);
  if (index !== -1) {
    leads[index] = { ...leads[index], ...updates, updatedAt: new Date().toISOString() };
    saveLeads(leads);
    return leads[index];
  }
  return null;
}

function createLeadWebhookHandlers(manager) {
  manager.on("lead_created", async (data) => {
    console.log("[Webhook] Lead created:", data.email);

    const leads = loadLeads();
    const existingLead = leads.find(l => l.email === data.email);

    if (existingLead) {
      console.log("[Webhook] Lead already exists, updating...");
      return updateLead(existingLead.id, data);
    }

    const newLead = {
      id: `lead_${Date.now()}`,
      ...data,
      status: data.status || "new",
      tier: data.tier || "C",
      score: data.score || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: data.source || "webhook"
    };

    leads.push(newLead);
    saveLeads(leads);

    console.log("[Webhook] New lead saved:", newLead.id);

    return { processed: true, leadId: newLead.id };
  });

  manager.on("lead_updated", async (data) => {
    console.log("[Webhook] Lead updated:", data.id || data.email);

    if (data.id) {
      const updated = updateLead(data.id, data);
      if (updated) {
        console.log("[Webhook] Lead updated successfully:", updated.id);
        return { processed: true, lead: updated };
      }
    }

    const leads = loadLeads();
    const lead = leads.find(l => l.email === data.email);
    if (lead) {
      const updated = updateLead(lead.id, data);
      return { processed: true, lead: updated };
    }

    return { processed: false, reason: "Lead not found" };
  });

  manager.on("score_changed", async (data) => {
    console.log("[Webhook] Score changed:", data.email, "New score:", data.score);

    let tier = "C";
    if (data.score >= 80) tier = "A";
    else if (data.score >= 50) tier = "B";

    const leads = loadLeads();
    const lead = leads.find(l => l.email === data.email);

    if (lead) {
      const updated = updateLead(lead.id, { score: data.score, tier });
      console.log("[Webhook] Lead tier updated to:", tier);
      return { processed: true, lead: updated };
    }

    return { processed: false, reason: "Lead not found" };
  });

  manager.on("crm_sync_complete", async (data) => {
    console.log("[Webhook] CRM sync complete:", data.recordsProcessed, "records");

    const syncLog = {
      timestamp: new Date().toISOString(),
      recordsProcessed: data.recordsProcessed || 0,
      errors: data.errors || 0,
      source: data.source || "external"
    };

    const logPath = path.join(LEADS_DIR, "sync-log.json");
    const existingLog = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : [];
    existingLog.push(syncLog);
    fs.writeFileSync(logPath, JSON.stringify(existingLog, null, 2));

    return { processed: true, syncLog };
  });
}

function createExternalCRMHandler(manager) {
  return async (eventData) => {
    switch (eventData.event) {
      case "contact.created":
      case "contact.updated":
        return manager.emit("lead_updated", eventData.data);

      case "deal.created":
      case "deal.updated":
        if (eventData.data.status === "won") {
          return manager.emit("lead_updated", {
            ...eventData.data,
            status: "won"
          });
        }
        break;

      default:
        console.log("[External CRM] Unknown event:", eventData.event);
    }
    return { processed: false, reason: "Unknown event" };
  };
}

function createEmailCampaignHandler(manager) {
  return async (eventData) => {
    const eventMap = {
      "email.opened": { status: "opened", score: 5 },
      "email.clicked": { status: "clicked", score: 10 },
      "email.replied": { status: "replied", score: 20 },
      "email.bounced": { status: "bounced", score: -5 },
      "email.unsubscribed": { status: "unsubscribed", score: -20 }
    };

    const mapped = eventMap[eventData.event];
    if (!mapped) {
      console.log("[Email Campaign] Unknown event:", eventData.event);
      return { processed: false, reason: "Unknown event" };
    }

    console.log("[Email Campaign] Event:", eventData.event, "for:", eventData.email);

    const leads = loadLeads();
    const lead = leads.find(l => l.email === eventData.email);

    if (lead) {
      const newScore = Math.max(0, (lead.score || 0) + mapped.score);
      let tier = "C";
      if (newScore >= 80) tier = "A";
      else if (newScore >= 50) tier = "B";

      const updated = updateLead(lead.id, {
        score: newScore,
        tier,
        lastActivity: eventData.event,
        lastActivityAt: new Date().toISOString()
      });

      manager.emit("score_changed", { email: eventData.email, score: newScore });

      return { processed: true, lead: updated };
    }

    return { processed: false, reason: "Lead not found" };
  };
}

function createLeadFormHandler(manager) {
  return async (formData) => {
    const requiredFields = ["email", "name"];
    for (const field of requiredFields) {
      if (!formData[field]) {
        return { processed: false, reason: `Missing required field: ${field}` };
      }
    }

    const leadData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || "",
      company: formData.company || "",
      website: formData.website || "",
      source: "landing-page",
      status: "new",
      tier: "C",
      score: 10,
      formFields: formData
    };

    console.log("[Lead Form] New submission:", leadData.email);

    return manager.emit("lead_created", leadData);
  };
}

function setupWebhookServer(manager, port = 3000) {
  const express = require("express");
  const app = express();

  app.use(express.json());

  app.post("/webhooks/incoming", async (req, res) => {
    const { payload, signature, event } = req.headers;
    const secret = process.env.WEBHOOK_SECRET_KEY || "";

    if (signature && secret) {
      const isValid = manager.verifySignature(JSON.stringify(req.body), signature, secret);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const eventType = event || req.body.event;
    if (!eventType) {
      return res.status(400).json({ error: "Event type required" });
    }

    try {
      const results = await manager.emit(eventType, req.body.data || req.body);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/webhooks/status", (req, res) => {
    res.json({
      endpoints: manager.listEndpoints(),
      eventTypes: manager.getEventTypes(),
      recentDeliveries: manager.getDeliveryLog(10)
    });
  });

  app.listen(port, () => {
    console.log(`[Webhook Server] Listening on port ${port}`);
  });

  return app;
}

async function runWebhookDemo() {
  console.log("=== Webhook Handlers Demo ===\n");

  const manager = createWebhookManager({
    secretKey: "demo_secret_key_12345",
    retryAttempts: 3,
    retryDelay: 500
  });

  createLeadWebhookHandlers(manager);

  console.log("1. Simulating lead form submission...");
  const formHandler = createLeadFormHandler(manager);
  await formHandler({
    name: "John Creator",
    email: "john@example.com",
    company: "Creator Co",
    website: "https://creatorco.example.com"
  });

  console.log("\n2. Simulating email campaign event...");
  const emailHandler = createEmailCampaignHandler(manager);
  await emailHandler({
    event: "email.opened",
    email: "john@example.com"
  });

  console.log("\n3. Simulating external CRM update...");
  const crmHandler = createExternalCRMHandler(manager);
  await crmHandler({
    event: "contact.updated",
    data: {
      email: "john@example.com",
      status: "qualified"
    }
  });

  console.log("\n4. Simulating score change...");
  await manager.emit("score_changed", {
    email: "john@example.com",
    score: 85
  });

  console.log("\n=== Demo Complete ===");
}

if (require.main === module) {
  runWebhookDemo().catch(console.error);
}

module.exports = {
  createLeadWebhookHandlers,
  createExternalCRMHandler,
  createEmailCampaignHandler,
  createLeadFormHandler,
  setupWebhookServer
};