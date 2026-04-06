#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAINS_PATH = path.join(ROOT, 'config', 'domains.json');
const STATS_PATH = path.join(ROOT, 'data', 'domain-stats.json');

// --- Helpers ---

function today() {
  return new Date().toISOString().slice(0, 10);
}

function loadDomains() {
  const raw = fs.readFileSync(DOMAINS_PATH, 'utf8');
  return JSON.parse(raw);
}

function saveDomains(data) {
  fs.writeFileSync(DOMAINS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function loadStats() {
  if (!fs.existsSync(STATS_PATH)) {
    fs.writeFileSync(STATS_PATH, '{}', 'utf8');
    return {};
  }
  const raw = fs.readFileSync(STATS_PATH, 'utf8').trim();
  if (!raw || raw === '') return {};
  return JSON.parse(raw);
}

function saveStats(stats) {
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2) + '\n', 'utf8');
}

function dailyLimit(warmupDay) {
  return Math.min(5 + (warmupDay - 1) * 5, 40);
}

function sendsToday(stats, domain) {
  const d = today();
  if (!stats[domain]) return 0;
  if (!stats[domain].sends) return 0;
  return stats[domain].sends[d] || 0;
}

// --- Core functions ---

/**
 * Returns the next domain that hasn't hit its daily limit (round-robin, skips domains at limit).
 */
function getNextDomain() {
  const { domains } = loadDomains();
  const stats = loadStats();

  for (let i = 0; i < domains.length; i++) {
    const entry = domains[i];
    const limit = dailyLimit(entry.warmup_day);
    const sent = sendsToday(stats, entry.domain);
    if (sent < limit) {
      return entry.domain;
    }
  }
  return null; // all domains at limit
}

/**
 * Records a send for a domain today.
 */
function recordSend(domain) {
  const stats = loadStats();
  const d = today();

  if (!stats[domain]) {
    stats[domain] = { sends: {} };
  }
  if (!stats[domain].sends) {
    stats[domain].sends = {};
  }
  stats[domain].sends[d] = (stats[domain].sends[d] || 0) + 1;
  saveStats(stats);
}

/**
 * Returns array of stats objects for all domains.
 */
function getDomainStats() {
  const { domains } = loadDomains();
  const stats = loadStats();

  return domains.map(entry => {
    const limit = dailyLimit(entry.warmup_day);
    const sent = sendsToday(stats, entry.domain);
    return {
      domain: entry.domain,
      warmup_day: entry.warmup_day,
      daily_limit: limit,
      sends_today: sent,
      remaining: limit - sent
    };
  });
}

/**
 * Adds a domain to config/domains.json.
 */
function addDomain(domain, dayAge) {
  const config = loadDomains();
  config.domains.push({
    domain: domain,
    warmup_day: Number(dayAge),
    added: today()
  });
  saveDomains(config);
}

// --- CLI ---

function printStats() {
  const rows = getDomainStats();
  // Header
  console.log('');
  console.log('  Domain Warmup Status');
  console.log('  ' + '-'.repeat(72));
  console.log(
    '  ' +
    'Domain'.padEnd(28) +
    'Day'.padEnd(6) +
    'Limit'.padEnd(8) +
    'Sent'.padEnd(8) +
    'Remaining'.padEnd(10)
  );
  console.log('  ' + '-'.repeat(72));
  for (const r of rows) {
    console.log(
      '  ' +
      r.domain.padEnd(28) +
      String(r.warmup_day).padEnd(6) +
      String(r.daily_limit).padEnd(8) +
      String(r.sends_today).padEnd(8) +
      String(r.remaining).padEnd(10)
    );
  }
  console.log('  ' + '-'.repeat(72));
  console.log('');
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'stats') {
    printStats();
  } else if (cmd === 'add') {
    const domain = args[1];
    const day = args[2];
    if (!domain || !day) {
      console.error('Usage: node email-domain-manager.js add <domain> <warmup-day>');
      process.exit(1);
    }
    addDomain(domain, day);
    console.log('Added domain: ' + domain + ' (warmup day ' + day + ')');
  } else if (cmd === 'next') {
    const next = getNextDomain();
    if (next) {
      console.log(next);
    } else {
      console.log('All domains at daily limit.');
    }
  } else if (cmd === 'record') {
    const domain = args[1];
    if (!domain) {
      console.error('Usage: node email-domain-manager.js record <domain>');
      process.exit(1);
    }
    recordSend(domain);
    console.log('Recorded send for ' + domain);
  } else {
    console.error('Unknown command: ' + cmd);
    console.error('Commands: stats, add, next, record');
    process.exit(1);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

module.exports = { getNextDomain, recordSend, getDomainStats, addDomain };
