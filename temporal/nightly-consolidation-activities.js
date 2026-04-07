// temporal/nightly-consolidation-activities.js
// Factory: createNightlyConsolidationActivities(config)
// Returns { runNightlyConsolidation }
'use strict';

var idempotencyUtils = require('./idempotency-utils');

const fs = require('fs');
const path = require('path');

/**
 * Factory that returns nightly-consolidation activity functions.
 * @param {object} config
 * @param {string} config.baseDir - project root directory
 * @returns {{ runNightlyConsolidation: function }}
 */
function createNightlyConsolidationActivities(config) {
  const baseDir = config && config.baseDir ? config.baseDir : process.cwd();

  /**
   * Parse a CSV file into an array of row objects.
   * Handles missing files gracefully by returning [].
   */
  function parseCsv(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw) return [];
    const [headerLine, ...lines] = raw.split('\n');
    const headers = headerLine.split(',').map(h => h.trim());
    return lines.map(line => {
      const values = line.split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, i) => { row[h] = values[i] || ''; });
      return row;
    });
  }

  /**
   * Core activity: reads CRM CSV + hunt log + inbound CSV,
   * counts metrics, builds KPI block, updates IDENTITY.md,
   * and writes metrics snapshot.
   */
  async function runNightlyConsolidation({ date }) {
    var idempotencyKey = 'nightly-consolidation:' + (date || new Date().toISOString().slice(0, 10));
    if (idempotencyUtils.alreadyProcessed(idempotencyKey)) {
      return { skipped: true, reason: 'already processed', key: idempotencyKey };
    }

    const today = date || new Date().toISOString().slice(0, 10);

    // --- Read source data ---
    const crmPath = path.join(baseDir, 'data', 'crm.csv');
    const huntPath = path.join(baseDir, 'data', 'hunt-log.csv');
    const inboundPath = path.join(baseDir, 'data', 'inbound.csv');

    const crmRows = parseCsv(crmPath);
    const huntRows = parseCsv(huntPath);
    const inboundRows = parseCsv(inboundPath);

    // --- Count metrics for today ---
    const leadsToday = crmRows.filter(r => (r.date || r.Date || '').startsWith(today)).length
      + inboundRows.filter(r => (r.date || r.Date || '').startsWith(today)).length;

    const conversations = huntRows.filter(r => (r.date || r.Date || '').startsWith(today)).length;

    const closedWon = crmRows.filter(r => {
      const status = (r.status || r.Status || '').toLowerCase();
      const rowDate = r.date || r.Date || '';
      return rowDate.startsWith(today) && (status === 'closed-won' || status === 'closed won');
    }).length;

    // --- Build KPI block ---
    const kpiBlock = [
      '<!-- KPI-STATUSSTART -->',
      '| Metric | Value | Date |',
      '|--------|-------|------|',
      `| Leads Today | ${leadsToday} | ${today} |`,
      `| Conversations | ${conversations} | ${today} |`,
      `| Closed-Won | ${closedWon} | ${today} |`,
      '<!-- KPI-STATUSEND -->',
    ].join('\n');

    // --- Update system/IDENTITY.md ---
    const identityPath = path.join(baseDir, 'system', 'IDENTITY.md');
    let identityContent = '';
    if (fs.existsSync(identityPath)) {
      identityContent = fs.readFileSync(identityPath, 'utf-8');
    }

    const startTag = '<!-- KPI-STATUS-START -->';
    const endTag = '<!-- KPI-STATUS-END -->';
    const startIdx = identityContent.indexOf(startTag);
    const endIdx = identityContent.indexOf(endTag);

    if (startIdx !== -1 && endIdx !== -1) {
      identityContent =
        identityContent.slice(0, startIdx) +
        kpiBlock +
        identityContent.slice(endIdx + endTag.length);
    } else {
      identityContent = identityContent.trimEnd() + '\n\n' + kpiBlock + '\n';
    }

    fs.mkdirSync(path.dirname(identityPath), { recursive: true });
    fs.writeFileSync(identityPath, identityContent, 'utf-8');

    // --- Write metrics snapshot ---
    const snapshotDir = path.join(baseDir, 'leads');
    fs.mkdirSync(snapshotDir, { recursive: true });
    const snapshotPath = path.join(snapshotDir, 'metrics-snapshot.txt');
    const snapshot = [
      `Metrics Snapshot —  ${today}`,
      '================================',
      `Leads Today:   ${leadsToday}`,
      `Conversations: ${conversations}`,
      `Closed-Won:    ${closedWon}`,
      `Generated:     ${new Date().toISOString()}`,
    ].join('\n');
    fs.writeFileSync(snapshotPath, snapshot, 'utf-8');

    idempotencyUtils.markProcessed(idempotencyKey);

    return { leadsToday, conversations, closedWon, date: today };
  }

  return { runNightlyConsolidation };
}

module.exports = { createNightlyConsolidationActivities };
