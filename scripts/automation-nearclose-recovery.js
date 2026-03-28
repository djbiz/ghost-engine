#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Near-Close Recovery
 * 48-hr re-hit for leads who said "not now", "send info", "later"
 *
 * Checks CRM for stalled leads → flags them for outreach
 * Usage: node automation-nearclose-recovery.js
 */

const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..");
const CRM_FILE = path.join(BASE, "leads", "crm.csv");
const STALLED_FILE = path.join(BASE, "leads", "near-close-recovery.csv");
const OBJECTION_FILE = path.join(BASE, "leads", "objections.csv");

const STALL_THRESHOLD_HOURS = 48;
const STALLED_STATUSES = ["contacted", "qualified", "proposal"];

// ─── MAIN ────────────────────────────────────────────────────────────────────

function parseCSV(filepath) {
  if (!fs.existsSync(filepath)) return [];
  const lines = fs.readFileSync(filepath, "utf8").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const vals = line.split(",");
    const row = {};
    headers.forEach((h, i) => (row[h.trim()] = vals[i]?.trim() || ""));
    return row;
  });
}

function getStalledLeads() {
  const leads = parseCSV(CRM_FILE);
  const now = Date.now();
  const threshold = STALL_THRESHOLD_HOURS * 60 * 60 * 1000;

  return leads.filter((lead) => {
    if (!STALLED_STATUSES.includes(lead.status)) return false;
    if (!lead.last_contact) return false;
    const lastContact = new Date(lead.last_contact).getTime();
    return now - lastContact >= threshold;
  });
}

function logObjection(lead, objection) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp},"${objection}","${lead.name || lead.email}"\n`;
  fs.appendFileSync(OBJECTION_FILE, line);
}

function main() {
  console.log(`\n🔄 GHOST ENGINE — NEAR-CLOSE RECOVERY\n`);
  console.log(`⏰ Checking for leads stalled ${STALL_THRESHOLD_HOURS}+ hours\n`);

  const stalled = getStalledLeads();

  if (stalled.length === 0) {
    console.log("✅ No stalled leads. Pipeline is moving.");
    return;
  }

  console.log(`⚠️  ${stalled.length} leads need re-engagement:\n`);
  console.log("| Name | Status | Last Contact | Recommended Action |");
  console.log("|------|--------|--------------|--------------------|");

  const recovery = stalled.map((lead) => {
    const lastContact = new Date(lead.last_contact).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    // Determine which objection pattern to use
    let action;
    const notes = lead.notes?.toLowerCase() || "";

    if (notes.includes("not now") || notes.includes("later")) {
      action = "Send 48hr re-engagement: 'what's actually holding you back?'";
      logObjection(lead, "Not now / Later");
    } else if (notes.includes("send info") || notes.includes("send me")) {
      action = "Send objection-crusher + mini-case study";
      logObjection(lead, "Send me info");
    } else if (notes.includes("price") || notes.includes("expensive") || notes.includes("cost")) {
      action = "Send proof of ROI + payment plan angle";
      logObjection(lead, "Too expensive");
    } else if (notes.includes("think") || notes.includes("consider")) {
      action = "Send urgency prompt: 'what's the real blocker?'";
      logObjection(lead, "Need to think about it");
    } else {
      action = "Generic re-engagement: 'still around?'";
      logObjection(lead, "Stalled - no specific objection");
    }

    console.log(`| ${lead.name || lead.email} | ${lead.status} | ${lastContact} | ${action} |`);

    return { lead, action };
  });

  // Save to recovery queue
  const recoveryHeader = "timestamp,lead_id,name,email,original_status,last_contact,recovery_action\n";
  const recoveryLines = recovery.map(({ lead, action }) => {
    return `${new Date().toISOString()},${lead.id},${lead.name || ""},${lead.email || ""},${lead.status},${lead.last_contact},"${action}"`;
  });

  if (!fs.existsSync(STALLED_FILE)) {
    fs.writeFileSync(STALLED_FILE, recoveryHeader);
  }
  fs.appendFileSync(STALLED_FILE, recoveryLines.join("\n") + "\n");

  console.log(`\n✅ Recovery queue saved → ${STALLED_FILE}`);
  console.log(`📊 Expected uplift: 20–30% of these can be revived with proper follow-up`);

  return recovery;
}

if (require.main === module) main();
module.exports = { getStalledLeads, main };
