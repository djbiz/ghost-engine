#!/usr/bin/env node
/**
 * Ghost Engine - LinkedIn Outreach Engine
 * Automated connection requests + DMs via Zo's browser
 * 
 * Usage:
 *   node linkedin-outreach.js connect <count>   - Send connection requests
 *   node linkedin-outreach.js dm <name> <msg>   - Send a DM
 *   node linkedin-outreach.js status            - Check connection stats
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../leads/linkedin-connections.csv');
const LOG_FILE = path.join(__dirname, '../leads/linkedin-log.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, 'id,timestamp,name,headline,url,status,notes\n');
}

// Load log
let log = { connections: [], dms: [] };
if (fs.existsSync(LOG_FILE)) {
  try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch(e) {}
}

function logConnection(name, headline, url) {
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    name,
    headline: headline || '',
    url: url || '',
    status: 'pending'
  };
  log.connections.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
  
  // Also add to CRM CSV
  const crmEntry = `${entry.id},${entry.timestamp},${name},LinkedIn,unknown,${headline || ''},linkedin,pending,\n`;
  fs.appendFileSync(DATA_FILE, crmEntry);
  return entry;
}

function getLastSearchURL(query) {
  const queries = {
    'creator': 'https://www.linkedin.com/search/results/people/?keywords=content%20creator%20founder&origin=SWITCH_SEARCH_V2',
    'tiktok': 'https://www.linkedin.com/search/results/people/?keywords=TikTok%20founder&origin=SWITCH_SEARCH_V2',
    'youtube': 'https://www.linkedin.com/search/results/people/?keywords=YouTube%20creator%20founder&origin=SWITCH_SEARCH_V2',
    'monetization': 'https://www.linkedin.com/search/results/people/?keywords=monetization%20creator%20founder&origin=SWITCH_SEARCH_V2',
  };
  return queries[query] || queries['creator'];
}

async function sendConnections(count = 5) {
  console.log(`\n📌 LINKEDIN OUTREACH — Sending ${count} connection requests...\n`);
  console.log('Open LinkedIn search in your browser:');
  console.log(getLastSearchURL('creator'));
  console.log('\nZo will send connection requests to creators matching your ICP.');
  console.log(`\nLog: ${log.connections.length} connections sent so far`);
  return log.connections.length;
}

async function sendDM(name, message) {
  console.log(`\n💬 LINKEDIN DM — Sending to ${name}...`);
  console.log(`Message: ${message}`);
  console.log('\n⚠️  DMs require 1st-degree connections. Build network first.');
}

async function showStatus() {
  const pending = log.connections.filter(c => c.status === 'pending').length;
  const accepted = log.connections.filter(c => c.status === 'connected').length;
  const total = log.connections.length;
  
  console.log(`
╔═══════════════════════════════════
║  LINKEDIN NETWORK STATUS         ║
╚═══════════════════════════════════
  Total sent:       ${total}
  Pending:          ${pending}
  Accepted:         ${accepted}
  
  Next action: Build connections → then DMs
`);
}

// CLI
const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === 'connect') {
  sendConnections(parseInt(args[1]) || 5);
} else if (cmd === 'dm') {
  sendDM(args[1], args.slice(2).join(' '));
} else if (cmd === 'status') {
  showStatus();
} else {
  console.log(`
📌 Ghost Engine — LinkedIn Outreach

Commands:
  node linkedin-outreach.js connect <count>   Send connection requests
  node linkedin-outreach.js dm <name> <msg>  Send a DM
  node linkedin-outreach.js status            Check network status

Search URLs to open in browser:
  Creators:    https://www.linkedin.com/search/results/people/?keywords=content%20creator%20founder
  TikTok:      https://www.linkedin.com/search/results/people/?keywords=TikTok%20founder
  YouTube:     https://www.linkedin.com/search/results/people/?keywords=YouTube%20creator%20founder
  Monetization: https://www.linkedin.com/search/results/people/?keywords=monetization%20creator%20founder
`);
}
