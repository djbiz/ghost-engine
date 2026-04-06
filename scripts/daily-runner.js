#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowISO() {
  return new Date().toISOString();
}

// --- Step 1: Ensure daily file exists ---

function ensureDailyFile(dateStr) {
  const dailyDir = path.join(ROOT, 'daily');
  const filePath = path.join(dailyDir, dateStr + '.md');

  if (fs.existsSync(filePath)) {
    console.log('[daily] ' + dateStr + '.md already exists.');
    return;
  }

  const templatePath = path.join(dailyDir, '2026-03-29.md');
  if (!fs.existsSync(templatePath)) {
    console.warn('[daily] Template 2026-03-29.md not found — skipping daily file creation.');
    return;
  }

  let content = fs.readFileSync(templatePath, 'utf8');
  content = content.replace(/2026-03-29/g, dateStr);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('[daily] Created ' + dateStr + '.md from template.');
}

// --- Step 2: CRM pipeline summary ---

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',');
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (values[j] || '').trim();
    }
    rows.push(obj);
  }
  return rows;
}

function loadCRM() {
  const crmPath = path.join(ROOT, 'leads', 'crm.csv');
  if (!fs.existsSync(crmPath)) {
    console.warn('[crm] leads/crm.csv not found.');
    return [];
  }
  const raw = fs.readFileSync(crmPath, 'utf8');
  return parseCSV(raw);
}

function printPipelineSummary(leads) {
  console.log('\n=== Pipeline Summary ===');
  console.log('Total leads: ' + leads.length);

  const byStatus = {};
  for (const lead of leads) {
    const s = lead.status || 'unknown';
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  for (const [status, count] of Object.entries(byStatus)) {
    console.log('  ' + status + ': ' + count);
  }
}

// --- Step 3: Last 5 slog entries ---

function loadSlog() {
  const slogPath = path.join(ROOT, 'slog.jsonl');
  if (!fs.existsSync(slogPath)) {
    console.warn('[slog] slog.jsonl not found.');
    return [];
  }
  const raw = fs.readFileSync(slogPath, 'utf8');
  const entries = [];

  function ingest(obj) {
    if (obj.a && Array.isArray(obj.a)) {
      for (const entry of obj.a) entries.push(entry);
    } else {
      entries.push(obj);
    }
  }

  for (const line of raw.trim().split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      ingest(JSON.parse(trimmed));
    } catch (e) {
      // Line may contain multiple concatenated JSON objects — try splitting on }{
      const parts = trimmed.split(/(?<=\})(?=\{)/);
      for (const part of parts) {
        try {
          ingest(JSON.parse(part));
        } catch (e2) {
          // skip truly malformed chunks
        }
      }
    }
  }
  return entries;
}

function printRecentSlog(entries) {
  console.log('\n=== Last 5 slog entries ===');
  const last5 = entries.slice(-5);
  for (const entry of last5) {
    const ts = entry.ts || '';
    const action = entry.action || entry.event || '';
    const detail = entry.detail || entry.summary || '';
    console.log('  [' + ts + '] ' + action + ' — ' + (typeof detail === 'object' ? JSON.stringify(detail) : detail));
  }
}

// --- Step 4: Check daily-hunt-log freshness ---

function checkHuntLog() {
  const huntPath = path.join(ROOT, 'leads', 'daily-hunt-log.csv');
  if (!fs.existsSync(huntPath)) {
    console.warn('\n[warn] leads/daily-hunt-log.csv not found.');
    return;
  }
  const stat = fs.statSync(huntPath);
  const modDate = stat.mtime.toISOString().slice(0, 10);
  const todayStr = today();
  if (modDate !== todayStr) {
    console.warn('\n[warn] daily-hunt-log.csv was last modified on ' + modDate + ' — NOT updated today (' + todayStr + ').');
  } else {
    console.log('\n[ok] daily-hunt-log.csv updated today.');
  }
}

// --- Step 5: Prioritized action list ---

function generateActions(leads, slogEntries) {
  console.log('\n=== Prioritized Actions ===');

  const actions = [];
  const nowMs = Date.now();
  const ms48h = 48 * 60 * 60 * 1000;

  for (const lead of leads) {
    // RE-ENGAGE DM: last_contact 48+ hours ago and status is not "closed"
    if (lead.last_contact && !lead.status.startsWith('closed')) {
      const lastMs = new Date(lead.last_contact).getTime();
      if (!isNaN(lastMs) && (nowMs - lastMs) >= ms48h) {
        actions.push({ type: 'RE-ENGAGE DM', name: lead.name, reason: 'No contact in 48+ hours' });
      }
    }

    // CLOSE PUSH: hot leads
    if (lead.status === 'hot') {
      actions.push({ type: 'CLOSE PUSH', name: lead.name, reason: 'Status is hot' });
    }
  }

  // URGENCY DM: Stripe click with no subsequent purchase/payment
  // Build set of leads with stripe/click events and check for purchase/payment
  const stripeClicks = {};
  const purchased = {};
  for (const entry of slogEntries) {
    const text = JSON.stringify(entry).toLowerCase();
    // Identify the lead from the entry if possible
    const leadName = entry.lead || entry.name || '';
    if (text.includes('stripe') || text.includes('click')) {
      if (leadName) stripeClicks[leadName] = true;
    }
    if (text.includes('purchase') || text.includes('payment')) {
      if (leadName) purchased[leadName] = true;
    }
  }
  for (const name of Object.keys(stripeClicks)) {
    if (!purchased[name]) {
      actions.push({ type: 'URGENCY DM', name: name, reason: 'Stripe click with no purchase' });
    }
  }

  if (actions.length === 0) {
    console.log('  No flagged actions.');
  } else {
    for (const a of actions) {
      console.log('  [' + a.type + '] ' + a.name + ' — ' + a.reason);
    }
  }

  return actions;
}

// --- Step 6: Append to slog ---

function appendSlog(leads, actions) {
  const slogPath = path.join(ROOT, 'slog.jsonl');
  const hotCount = leads.filter(l => l.status === 'hot').length;
  const entry = {
    ts: nowISO(),
    event: 'daily-runner-check',
    summary: {
      total_leads: leads.length,
      hot_leads: hotCount,
      actions_flagged: actions.length
    }
  };
  fs.appendFileSync(slogPath, '\n' + JSON.stringify(entry), 'utf8');
  console.log('\n[slog] Appended daily-runner-check entry.');
}

// --- Main ---

function main() {
  const dateStr = today();
  console.log('Daily Runner — ' + dateStr);
  console.log('='.repeat(40));

  // Step 1
  ensureDailyFile(dateStr);

  // Step 2
  const leads = loadCRM();
  printPipelineSummary(leads);

  // Step 3
  const slogEntries = loadSlog();
  printRecentSlog(slogEntries);

  // Step 4
  checkHuntLog();

  // Step 5
  const actions = generateActions(leads, slogEntries);

  // Step 6
  appendSlog(leads, actions);

  console.log('\nDone.');
}

main();
