#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Hot Lead Alert System
 * Monitors for: discovery call bookings, Stripe payments, high-score leads
 * SMSes Derek immediately when these fire
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const CALLS_FILE = path.join(__dirname, "..", "leads", "discovery-calls.csv");
const PAYMENT_CHECK = "https://derekjamieson29.zo.space/api/ghost-stats";
const PROCESSED_ALERTS = path.join(__dirname, "..", "leads", "alerts-processed.txt");

function wasAlerted(leadId, event) {
  const key = `${leadId}:${event}`;
  if (!fs.existsSync(PROCESSED_ALERTS)) return false;
  return fs.readFileSync(PROCESSED_ALERTS, "utf8").includes(key);
}

function markAlerted(leadId, event) {
  const key = `${leadId}:${event}\n`;
  fs.appendFileSync(PROCESSED_ALERTS, key);
}

function loadCSV(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf8").trim().split("\n");
  if (lines.length <= 1) return [];
  const headers = lines[0].split(",").map(h => h.replace(/"/g, "").trim());
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || "").replace(/"/g, "").trim());
    return obj;
  });
}

async function fetchStripeStats() {
  try {
    const res = await fetch(PAYMENT_CHECK);
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
}

async function sendAlert(message) {
  // This will be picked up by the daily Closer agent which handles SMS
  console.log(`[HOT LEAD ALERT] ${message}`);
  // Also write to alerts queue for the agent to pick up
  const alertFile = path.join(__dirname, "..", "leads", "alert-queue.txt");
  fs.appendFileSync(alertFile, `[${new Date().toISOString()}] ${message}\n`);
}

async function run() {
  console.log("[Hot Lead Alert] Checking for priority events...");

  // 1. Check discovery calls
  const calls = loadCSV(CALLS_FILE);
  for (const call of calls.slice(-10)) {
    if ((call.status === "booked" || call.status === "confirmed") && !wasAlerted(call.id, "call-booked")) {
      await sendAlert(
        `📞 CALL BOOKED: ${call.name} — ${call.platform}, ${call.followers || "?"} followers. ${call.preferred_day || ""} ${call.preferred_time || ""}. Priority: HIGH`
      );
      markAlerted(call.id, "call-booked");
    }
  }

  // 2. Check Stripe payments
  const stats = await fetchStripeStats();
  if (stats?.stats?.revenue > 0) {
    const lastKnown = parseFloat(fs.existsSync(path.join(__dirname, "..", "leads", ".last-revenue")) || "0");
    if (stats.stats.revenue > lastKnown) {
      const newRevenue = stats.stats.revenue - lastKnown;
      fs.writeFileSync(path.join(__dirname, "..", "leads", ".last-revenue"), stats.stats.revenue.toString());
      await sendAlert(
        `💰 PAYMENT RECEIVED: $${newRevenue.toFixed(0)}! Total pipeline: $${stats.stats.revenue}. Check Stripe ASAP!`
      );
    }
  }

  // 3. Check for high-score leads
  const crm = loadCSV(path.join(__dirname, "..", "leads", "crm.csv"));
  for (const lead of crm.slice(-20)) {
    const score = parseInt(lead.score || "0");
    if (score >= 9 && (lead.status === "new" || lead.status === "qualified") && !wasAlerted(lead.id, "hot-lead")) {
      await sendAlert(
        `🔥 HOT LEAD: ${lead.name} — ${lead.platform || "?"}, ${lead.followers || "?"} followers, score ${lead.score}. Immediate follow-up needed.`
      );
      markAlerted(lead.id, "hot-lead");
    }
  }

  console.log("[Hot Lead Alert] Check complete.");
}

run().catch(console.error);
