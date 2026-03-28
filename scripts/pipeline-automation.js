#!/usr/bin/env node
/**
 * Ghost Engine - Pipeline Automation Engine
 * Runs every hour. Manages the entire lead lifecycle.
 */

const fs = require("fs");
const path = require("path");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const LEADS_INBOUND = `${BASE}/leads/inbound.csv`;
const LEADS_CRM = `${BASE}/leads/crm.csv`;
const DISCOVERY = `${BASE}/leads/discovery-calls.csv`;
const CLOSE_LOG = `${BASE}/scripts/close-log.jsonl`;
const LESSONS = `${BASE}/lessons-learned.md`;
const MEMORY = `${BASE}/MEMORY.md`;

const ESCALATE_SCRIPT = `${BASE}/scripts/automation-hot-lead-alert.js`;
const FOLLOWUP_SCRIPT = `${BASE}/scripts/automation-followup.js`;
const MOMENTUM_SCRIPT = `${BASE}/scripts/automation-momentum-tracker.js`;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function readCSV(path) {
  if (!fs.existsSync(path)) return [];
  const raw = fs.readFileSync(path, "utf8").trim();
  if (!raw) return [];
  const lines = raw.split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const vals = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = vals[i] ? vals[i].trim() : "");
    return obj;
  });
}

function writeCSV(path, headers, rows) {
  const lines = [headers.join(",")];
  rows.forEach(r => lines.push(Object.values(r).join(",")));
  fs.writeFileSync(path, lines.join("\n"), "utf8");
}

function getStatus(file) {
  const leads = readCSV(file);
  const counts = {};
  leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
  return counts;
}

function run() {
  log("PIPELINE CHECK STARTING");

  const inbound = getStatus(LEADS_INBOUND);
  const crm = getStatus(LEADS_CRM);
  const discovery = readCSV(DISCOVERY);
  const closeLog = fs.existsSync(CLOSE_LOG)
    ? fs.readFileSync(CLOSE_LOG, "utf8").trim().split("\n").filter(Boolean)
    : [];

  log(`Inbound: ${JSON.stringify(inbound)}`);
  log(`CRM: ${JSON.stringify(crm)}`);
  log(`Discovery calls: ${discovery.length}`);
  log(`Total closes: ${closeLog.length}`);

  // Rule: new leads waiting >2h without score -> flag
  // Rule: discovery calls without confirmed time -> follow up
  // Rule: ghost leads 48h -> re-engage
  // Rule: hot leads score>=90 -> escalate

  const now = Date.now();
  let actions = [];

  // Check discovery calls
  discovery.forEach(call => {
    if (call.status === "booked" && !call.confirmed_time) {
      actions.push(`Follow up: ${call.name || call.email} - confirm call time`);
    }
    if (call.status === "completed" && !call.closed) {
      actions.push(`Close follow up: ${call.name || call.email} - get decision`);
    }
  });

  // Rule engine
  if ((inbound.new || 0) > 10) {
    actions.push("⚠️ 10+ new leads unprocessed - trigger scoring now");
  }
  if ((crm.qualified || 0) > 20) {
    actions.push("Pipeline is full - focus on closes not new leads");
  }
  if ((crm.proposal || 0) > 5) {
    actions.push("Multiple proposals out - check in on decisions");
  }
  if (closeLog.length >= 3) {
    actions.push("3+ closes - trigger proof loop immediately");
  }

  // Print actions
  if (actions.length) {
    console.log("\n⚡ ACTIONS NEEDED:");
    actions.forEach(a => console.log("  " + a));
  } else {
    console.log("\n✅ Pipeline healthy - no urgent actions");
  }

  log("PIPELINE CHECK COMPLETE");
}

run();
