#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Auto-First Touch
 * When a lead enters the CRM, send a DM or email instantly
 * Uses Rube for LinkedIn/Twitter DMs
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const RUBE_JWT = process.env.RUBE_JWT || "";
const LINKEDIN_SESSION = process.env.LINKEDIN_SESSION || "";
const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN || "";

const CRM_FILE = path.join(__dirname, "..", "leads", "crm.csv");
const OUTREACH_LOG = path.join(__dirname, "..", "leads", "first-touch-log.csv");
const PROCESSED_FILE = path.join(__dirname, "..", "leads", "first-touch-processed.txt");

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

function saveProcessed(id) {
  if (!fs.existsSync(PROCESSED_FILE)) fs.writeFileSync(PROCESSED_FILE, "");
  const existing = fs.readFileSync(PROCESSED_FILE, "utf8");
  if (!existing.includes(id)) {
    fs.appendFileSync(PROCESSED_FILE, `${id}\n`);
  }
}

function wasProcessed(id) {
  if (!fs.existsSync(PROCESSED_FILE)) return false;
  return fs.readFileSync(PROCESSED_FILE, "utf8").includes(id);
}

function logFirstTouch(lead, channel, success) {
  const row = `${new Date().toISOString()},${lead.name || ""},${lead.email || ""},${lead.platform || ""},${channel},${success}\n`;
  if (!fs.existsSync(OUTREACH_LOG)) {
    fs.writeFileSync(OUTREACH_LOG, "timestamp,name,email,platform,channel,success\n");
  }
  fs.appendFileSync(OUTREACH_LOG, row);
}

function buildFirstTouchDM(lead) {
  const firstName = (lead.name || "there").split(" ")[0];
  const platform = lead.platform || "content";

  const options = [
    `Hey ${firstName} — quick question: are you monetizing that ${platform} audience yet, or still figuring it out?`,
    `Just saw your content — solid engagement. Are you actually converting that into revenue yet?`,
    `Hey ${firstName} — you're clearly putting in the work on ${platform}. Question: is there a way for people to buy anything from you yet?`,
  ];

  return options[Math.floor(Math.random() * options.length)];
}

async function sendViaRube({ platform, handle, message }) {
  if (!RUBE_JWT) {
    console.log("[First Touch] RUBE_JWT not set — skipping Rube DM");
    return false;
  }

  // Create Rube session
  const sessionPayload = JSON.stringify({
    jsonrpc: "2.0",
    method: "RUBE_CREATE_SESSION",
    id: 1,
    params: {
      workflow_name: "ghost-engine-first-touch",
      memory: { app: [`${platform} outreach to ${handle}`] }
    }
  });

  let sessionId;
  try {
    const sessionRes = await fetch("https://rube.app/mcp", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUBE_JWT}`,
        "Content-Type": "application/json"
      },
      body: sessionPayload
    });
    const sessionData = await sessionRes.json();
    sessionId = sessionData?.result?.session_id;
  } catch (e) {
    console.error("[Rube] Session error:", e.message);
    return false;
  }

  if (!sessionId) return false;

  // Execute DM
  const toolName = platform === "linkedin" ? "linkedin_send_message" : "twitter_send_dm";
  const execPayload = JSON.stringify({
    jsonrpc: "2.0",
    method: "RUBE_MULTI_EXECUTE_TOOL",
    id: 2,
    params: {
      session_id: sessionId,
      tools: [{ tool: toolName, params: { recipient: handle, message } }],
      memory: { app: [`first touch DM to ${handle}`] }
    }
  });

  try {
    const execRes = await fetch("https://rube.app/mcp", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUBE_JWT}`,
        "Content-Type": "application/json"
      },
      body: execPayload
    });
    const execData = await execRes.json();
    return execData?.result?.success === true;
  } catch (e) {
    console.error("[Rube] Exec error:", e.message);
    return false;
  }
}

async function run() {
  const leads = loadCSV(CRM_FILE);
  const newLeads = leads.filter(l =>
    (l.status === "new" || l.status === "queued") &&
    !wasProcessed(l.id) &&
    (l.email || l.linkedin || l.twitter)
  );

  console.log(`[First Touch] ${newLeads.length} new leads to process`);

  for (const lead of newLeads.slice(0, 10)) {
    const firstTouchDM = buildFirstTouchDM(lead);
    let success = false;

    if (lead.linkedin) {
      success = await sendViaRube({
        platform: "linkedin",
        handle: lead.linkedin,
        message: firstTouchDM
      });
      logFirstTouch(lead, "linkedin", success);
    } else if (lead.twitter) {
      success = await sendViaRube({
        platform: "twitter",
        handle: lead.twitter,
        message: firstTouchDM
      });
      logFirstTouch(lead, "twitter", success);
    }

    if (success) {
      saveProcessed(lead.id);
      // Update CRM status
      lead.status = "first-touch-sent";
      console.log(`[First Touch] ✓ Sent to ${lead.name}`);
    }

    // Rate limit between sends
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log("[First Touch] Done.");
}

run().catch(console.error);
