#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Speed Close Trigger
 * When someone clicks Stripe but doesn't buy → DM fires within 5 minutes
 *
 * Usage: node automation-speed-close.js
 * Run via webhook from Stripe checkout abandonment
 * Or as a cron every 15 minutes checking Stripe API
 */

const https = require("https");

const BASE = "/home/workspace/Ghost-Monitization-Engine";

// Rube MCP endpoint for sending DMs
const RUBE_MCP_URL = "https://rube.app/mcp";

// ─── TRIGGER FROM STRIPE ────────────────────────────────────────────────────
//
// Option A: Stripe Checkout session webhook
//   -> When checkout.session.expired fires, call handleAbandonment(email, name)
//   -> Finds lead in CRM -> triggers speed close DM
//
// Option B: Poll Stripe every 15 min
//   -> Check for sessions created 5-30 min ago with status=open
//   -> Fire DM for any still unpaid
//
// ─── SPEED CLOSE MESSAGE ────────────────────────────────────────────────────

const SPEED_CLOSE_MSG = `Hey — I saw you checked the payment page.

Usually that means you're close.

What held you back?

Price? Time? Not sure it'll work?

I can probably help sort it out.

Still interested?`;

const FOLLOW_UP_2 = `Hey — following up.

You were close to getting started.

The offer's still available.

If the timing wasn't right — I get it.

Just don't want you sitting in the same spot 3 months from now.

Worth a quick chat?`;

const FOLLOW_UP_3 = `Last one from me on this.

I've seen it a hundred times — someone ready to move, got distracted, then the moment passed.

Don't let that be you.

If you're serious — I'm here.

If not — no hard feelings. Keep building.`;

// ─── MAIN LOGIC ─────────────────────────────────────────────────────────────

function findLeadByEmail(email) {
  const fs = require("fs");
  const path = require("path");
  const crmFile = path.join(BASE, "leads", "crm.csv");
  if (!fs.existsSync(crmFile)) return null;
  const lines = fs.readFileSync(crmFile, "utf8").trim().split("\n");
  if (lines.length < 2) return null;
  const headers = lines[0].split(",");
  for (const line of lines.slice(1)) {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = vals[i]?.trim() || ""));
    if (row.email === email) return row;
  }
  return null;
}

function logAttempt(email, stage) {
  const fs = require("fs");
  const path = require("path");
  const log = path.join(BASE, "leads", "speed-close-log.csv");
  const line = `${new Date().toISOString()},${email},${stage}\n`;
  if (!fs.existsSync(log)) fs.writeFileSync(log, "timestamp,email,stage\n");
  fs.appendFileSync(log, line);
}

// ─── SEND VIA RUBE (LinkedIn/Twitter DM) ────────────────────────────────────

async function sendViaRube(contact, message, platform = "linkedin") {
  const RUBE_JWT = process.env.RUBE_JWT;
  if (!RUBE_JWT) {
    console.log("⚠️  RUBE_JWT not set — cannot send DM automatically");
    console.log(`📝 MANUAL DM NEEDED for ${contact.email}: ${message.slice(0, 50)}...`);
    return { sent: false, reason: "no_rube_jwt" };
  }

  return new Promise((resolve) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: "dm.send",
      params: {
        platform,
        recipient: contact.username || contact.email,
        message,
      },
      id: Date.now(),
    });

    const options = {
      hostname: "rube.app",
      path: "/mcp",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUBE_JWT}`,
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ sent: true, response: JSON.parse(data) });
        } catch {
          resolve({ sent: false, reason: "parse_error" });
        }
      });
    });
    req.on("error", () => resolve({ sent: false, reason: "network_error" }));
    req.write(body);
    req.end();
  });
}

// ─── HANDLERS ───────────────────────────────────────────────────────────────

async function handleSpeedClose(email, name) {
  console.log(`\n⚡ SPEED CLOSE TRIGGER for ${email}\n`);

  const lead = findLeadByEmail(email);
  if (!lead) {
    console.log(`⚠️  Lead not in CRM — add manually or they came from paid traffic`);
    return { handled: false, reason: "not_in_crm" };
  }

  console.log(`✅ Found in CRM: ${lead.name} (${lead.platform})`);
  console.log(`📤 Sending speed close DM...`);

  const result = await sendViaRube(lead, SPEED_CLOSE_MSG, lead.platform || "linkedin");
  logAttempt(email, result.sent ? "dm_1_sent" : `dm_1_failed_${result.reason}`);

  if (result.sent) {
    console.log(`✅ Speed close DM #1 sent`);
  }

  return result;
}

async function handleFollowUp(email, stage = 2) {
  const msg = stage === 2 ? FOLLOW_UP_2 : FOLLOW_UP_3;
  const lead = findLeadByEmail(email);
  if (!lead) return;

  const result = await sendViaRube(lead, msg, lead.platform || "linkedin");
  logAttempt(email, result.sent ? `dm_${stage}_sent` : `dm_${stage}_failed`);

  console.log(`${result.sent ? "✅" : "⚠️"} Follow-up #${stage} ${result.sent ? "sent" : "failed"} for ${email}`);
  return result;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "speed-close") {
    const email = args[1];
    if (!email) {
      console.log("Usage: node automation-speed-close.js speed-close <email> [name]");
      process.exit(1);
    }
    await handleSpeedClose(email, args[2]);
  } else if (command === "follow-up") {
    const email = args[1];
    const stage = parseInt(args[2] || "2");
    await handleFollowUp(email, stage);
  } else {
    console.log(`
⚡ Speed Close Automation

Usage:
  node automation-speed-close.js speed-close <email> [name]
    -> Fire speed close DM immediately

  node automation-speed-close.js follow-up <email> [stage]
    -> Fire follow-up 2 or 3

Setup:
  Set RUBE_JWT env var for automatic LinkedIn/Twitter DMs.
  Without it, logs what needs to be sent manually.
`);
  }
}

if (require.main === module) main();
module.exports = { handleSpeedClose, handleFollowUp, sendViaRube };
