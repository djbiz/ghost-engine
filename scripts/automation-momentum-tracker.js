#!/usr/bin/env node
/**
 * Ghost Monetization Engine — Deal Momentum Tracker
 * Daily metrics dashboard: leads, replies, calls, closes
 * Reports what needs to happen to hit close targets
 */

const fs = require("fs");
const path = require("path");

const BASE = "/home/workspace/Ghost-Monitization-Engine";
const CRM_FILE = path.join(BASE, "leads", "crm.csv");
const CLIENTS_FILE = path.join(BASE, "clients", "active.csv");
const LOG_FILE = path.join(BASE, "leads", "daily-hunt-log.csv");

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

function main() {
  console.log("\n═══════════════════════════════════════");
  console.log("  GHOST ENGINE — MOMENTUM TRACKER");
  console.log("═══════════════════════════════════════\n");

  const leads = parseCSV(CRM_FILE);
  const clients = parseCSV(CLIENTS_FILE);

  const totalLeads = leads.length;
  const newToday = leads.filter(l => {
    if (!l.timestamp) return false;
    const d = new Date(l.timestamp).toISOString().split("T")[0];
    return d === new Date().toISOString().split("T")[0];
  }).length;

  const byStatus = {
    new: leads.filter(l => l.status === "new").length,
    contacted: leads.filter(l => l.status === "contacted").length,
    qualified: leads.filter(l => l.status === "qualified").length,
    proposal: leads.filter(l => l.status === "proposal").length,
    won: leads.filter(l => l.status === "won").length,
    lost: leads.filter(l => l.status === "lost").length,
  };

  const activeClients = clients.filter(c => c.status === "active" || c.status === "in_progress");
  const totalRevenue = clients.reduce((sum, c) => sum + (parseFloat(c.investment) || 0), 0);

  console.log(`📊 PIPELINE`);
  console.log(`   Total leads: ${totalLeads} (${newToday} today)`);
  console.log(`   By status: new=${byStatus.new} | contacted=${byStatus.contacted} | qualified=${byStatus.qualified} | proposal=${byStatus.proposal}`);
  console.log("");
  console.log(`💰 REVENUE`);
  console.log(`   Active clients: ${activeClients.length}`);
  console.log(`   Total closed: $${totalRevenue.toLocaleString()}`);
  console.log("");

  // Momentum math
  const targetCloses = 2;
  const currentCloses = byStatus.won;
  const neededToday = Math.max(0, targetCloses - currentCloses);
  const convRate = totalLeads > 0 ? ((byStatus.won / totalLeads) * 100).toFixed(1) : 0;
  const leadsNeeded = neededToday > 0 && convRate > 0
    ? Math.ceil(neededToday / (convRate / 100))
    : 0;

  console.log("═══════════════════════════════════════");

  if (currentCloses >= targetCloses) {
    console.log("  ✅ CLOSE TARGET MET");
  } else {
    console.log(`  🎯 TO HIT ${targetCloses} CLOSES:`);
    console.log(`     Current closes: ${currentCloses}/${targetCloses}`);
    console.log(`     You need: ~${leadsNeeded} more quality conversations today`);
    console.log(`     Pipeline conversion rate: ${convRate}%`);
    console.log(`     Required: ${neededToday} more close(s)`);
  }

  console.log("\n═══════════════════════════════════════\n");

  // Log today's activity
  const today = new Date().toISOString().split("T")[0];
  const logLine = `${today},${newToday},${byStatus.contacted},"conversion:${convRate}%,revenue:$${totalRevenue}"\n`;
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "date,leads_found,queued,notes\n");
  fs.appendFileSync(LOG_FILE, logLine);

  return { totalLeads, newToday, byStatus, totalRevenue, neededToday, leadsNeeded };
}

if (require.main === module) main();
module.exports = { main };
