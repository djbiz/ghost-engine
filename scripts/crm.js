#!/usr/bin/env node
/**
 * Ghost Monetization Engine — CRM & Lead Tracker
 * Simple CSV-based CRM for tracking leads and clients
 */

const fs = require("fs");
const path = require("path");

const CRM_FILE = "./leads/crm.csv";
const CLIENTS_FILE = "./clients/active.csv";
const ARCHIVE_FILE = "./clients/archived.csv";

// Ensure directories exist
["leads", "clients"].forEach(dir => {
  const dirPath = path.join(__dirname, "..", dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Initialize CSV files with headers if they don't exist
function initCRM() {
  [CRM_FILE, CLIENTS_FILE, ARCHIVE_FILE].forEach(file => {
    const fullPath = path.join(__dirname, "..", file);
    if (!fs.existsSync(fullPath)) {
      const headers = file === CRM_FILE 
        ? "id,timestamp,name,platform,followers,email,score,status,last_contact,notes,next_action\n"
        : "id,timestamp,name,platform,followers,email,investment,tier,start_date,end_date,status,revenue_generated,case_study\n";
      fs.writeFileSync(fullPath, headers);
    }
  });
}

function readCSV(filename) {
  const fullPath = path.join(__dirname, "..", filename);
  if (!fs.existsSync(fullPath)) return [];
  
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.trim().split("\n");
  if (lines.length <= 1) return [];
  
  const headers = lines[0].split(",");
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i] || "");
    return obj;
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function writeCSV(filename, data, headers) {
  const fullPath = path.join(__dirname, "..", filename);
  const content = [headers.join(","), ...data.map(row => headers.map(h => `"${(row[h] || "").toString().replace(/"/g, '""')}"`).join(","))].join("\n");
  fs.writeFileSync(fullPath, content);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// Commands
const cmd = process.argv[2];

if (cmd === "add-lead") {
  initCRM();
  const leads = readCSV(CRM_FILE);
  
  const newLead = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    name: process.argv[3] || "Unknown",
    platform: process.argv[4] || "tiktok",
    followers: process.argv[5] || "0",
    email: process.argv[6] || "",
    score: process.argv[7] || "50",
    status: "new",
    last_contact: "",
    notes: process.argv[8] || "",
    next_action: ""
  };
  
  leads.push(newLead);
  writeCSV(CRM_FILE, leads, ["id","timestamp","name","platform","followers","email","score","status","last_contact","notes","next_action"]);
  console.log(`✓ Added lead: ${newLead.name} (${newLead.id})`);
}

else if (cmd === "list-leads") {
  initCRM();
  const leads = readCSV(CRM_FILE);
  console.log(`\n📋 GHOST ENGINE — ${leads.length} leads in CRM\n`);
  leads.forEach(l => {
    console.log(`[${l.id}] ${l.name} | ${l.platform} | ${l.followers} followers | Score: ${l.score} | Status: ${l.status}`);
    if (l.notes) console.log(`  Notes: ${l.notes}`);
  });
  console.log();
}

else if (cmd === "update-status") {
  initCRM();
  const leads = readCSV(CRM_FILE);
  const [id, newStatus] = [process.argv[3], process.argv[4]];
  
  const lead = leads.find(l => l.id === id);
  if (!lead) { console.log("Lead not found"); process.exit(1); }
  
  lead.status = newStatus;
  lead.last_contact = new Date().toISOString();
  writeCSV(CRM_FILE, leads, ["id","timestamp","name","platform","followers","email","score","status","last_contact","notes","next_action"]);
  console.log(`✓ Updated ${lead.name} → ${newStatus}`);
}

else if (cmd === "convert-client") {
  initCRM();
  const leads = readCSV(CRM_FILE);
  const clients = readCSV(CLIENTS_FILE);
  
  const [id, investment, tier] = [process.argv[3], process.argv[4], process.argv[5]];
  const lead = leads.find(l => l.id === id);
  if (!lead) { console.log("Lead not found"); process.exit(1); }
  
  const newClient = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    name: lead.name,
    platform: lead.platform,
    followers: lead.followers,
    email: lead.email,
    investment: investment,
    tier: tier,
    start_date: new Date().toISOString(),
    end_date: "",
    status: "active",
    revenue_generated: "0",
    case_study: "no"
  };
  
  clients.push(newClient);
  writeCSV(CLIENTS_FILE, clients, ["id","timestamp","name","platform","followers","email","investment","tier","start_date","end_date","status","revenue_generated","case_study"]);
  
  // Remove from leads
  const updatedLeads = leads.filter(l => l.id !== id);
  writeCSV(CRM_FILE, updatedLeads, ["id","timestamp","name","platform","followers","email","score","status","last_contact","notes","next_action"]);
  
  console.log(`✓ Converted ${lead.name} to client — Tier ${tier}, $${investment}`);
}

else if (cmd === "list-clients") {
  initCRM();
  const clients = readCSV(CLIENTS_FILE);
  const totalRevenue = clients.reduce((sum, c) => sum + (parseFloat(c.revenue_generated) || 0), 0);
  const totalInvestment = clients.reduce((sum, c) => sum + (parseFloat(c.investment) || 0), 0);
  
  console.log(`\n👻 GHOST ENGINE — ${clients.length} clients | $${totalInvestment.toLocaleString()} invested | $${totalRevenue.toLocaleString()} generated\n`);
  clients.forEach(c => {
    const roi = c.investment > 0 ? Math.round((c.revenue_generated / c.investment) * 100) : 0;
    console.log(`[${c.id}] ${c.name} | ${c.platform} | ${c.tier} | $${c.investment} | Revenue: $${c.revenue_generated} (${roi}% ROI) | ${c.status}`);
  });
  console.log();
}

else if (cmd === "stats") {
  initCRM();
  const leads = readCSV(CRM_FILE);
  const clients = readCSV(CLIENTS_FILE);
  
  const statusCounts = {};
  leads.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1; });
  
  const totalRevenue = clients.reduce((sum, c) => sum + (parseFloat(c.revenue_generated) || 0), 0);
  const totalInvestment = clients.reduce((sum, c) => sum + (parseFloat(c.investment) || 0), 0);
  const avgDeal = clients.length > 0 ? Math.round(totalInvestment / clients.length) : 0;
  
  console.log(`
╔══════════════════════════════════════╗
║   GHOST MONETIZATION ENGINE — STATS  ║
╠══════════════════════════════════════╣
║  Leads: ${leads.length.toString().padEnd(25)}║
║  New: ${(statusCounts.new || 0).toString().padEnd(28)}║
║  Contacted: ${(statusCounts.contacted || 0).toString().padEnd(24)}║
║  Qualified: ${(statusCounts.qualified || 0).toString().padEnd(25)}║
║  Proposal: ${(statusCounts.proposal || 0).toString().padEnd(25)}║
╠══════════════════════════════════════╣
║  Active Clients: ${clients.length.toString().padEnd(21)}║
║  Total Invested: $${totalInvestment.toLocaleString().padEnd(18)}║
║  Total Revenue: $${totalRevenue.toLocaleString().padEnd(18)}║
║  Avg Deal Size: $${avgDeal.toLocaleString().padEnd(18)}║
║  ROI: ${clients.length > 0 ? Math.round((totalRevenue/totalInvestment)*100) : 0}%                          ║
╚══════════════════════════════════════╝
`);
}

else {
  console.log(`
👻 Ghost Monetization Engine — CRM

Usage:
  node crm.js add-lead <name> <platform> <followers> [email] [score] [notes]
  node crm.js list-leads
  node crm.js list-clients
  node crm.js update-status <id> <new_status>
  node crm.js convert-client <lead_id> <investment> <tier>
  node crm.js stats

Status values: new, contacted, qualified, proposal, won, lost
Tiers: tier1, tier2, tier3
`);
}

initCRM();
