'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Factory: createScoreDecayActivities(config)
 * Returns { runScoreDecay }
 *
 * Reads leads from leads/crm.csv, applies time-based score decay:
 *   -2  at  7 days
 *   -5  at 14 days
 *  -10  at 30 days
 *  -20  at 60 days
 *  -30  at 90 days
 * Floor at 0. Writes updated scores back to CSV.
 */
function createScoreDecayActivities(config) {
  const basePath = config.basePath || process.cwd();
  const crmPath = path.join(basePath, 'leads', 'crm.csv');

  const DECAY_RULES = [
    { days: 90, penalty: -30 },
    { days: 60, penalty: -20 },
    { days: 30, penalty: -10 },
    { days: 14, penalty: -5 },
    { days: 7,  penalty: -2 },
  ];

  function parseCsv(raw) {
    const lines = raw.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
    return { headers, rows };
  }

  function toCsv(headers, rows) {
    const headerLine = headers.join(',');
    const dataLines = rows.map(row => headers.map(h => row[h] ?? '').join(','));
    return [headerLine, ...dataLines].join('\n') + '\n';
  }

  function computeDecay(lastActivityDate, now) {
    if (!lastActivityDate) return 0;
    const last = new Date(lastActivityDate);
    if (isNaN(last.getTime())) return 0;
    const diffMs = now.getTime() - last.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    for (const rule of DECAY_RULES) {
      if (diffDays >= rule.days) {
        return rule.penalty;
      }
    }
    return 0;
  }

  async function runScoreDecay({ date }) {
    console.log(`[score-decay-activity] Starting decay run for ${date}`);

    if (!fs.existsSync(crmPath)) {
      console.log(`[score-decay-activity] CRM file not found at ${crmPath}, skipping`);
      return { processed: 0, decayed: 0 };
    }

    const raw = fs.readFileSync(crmPath, 'utf-8');
    const { headers, rows } = parseCsv(raw);

    const now = new Date(date + 'T00:00:00Z');
    let decayedCount = 0;

    for (const row of rows) {
      const lastActivity = row.last_activity || row.lastActivity || row.last_activity_date || '';
      const currentScore = parseInt(row.score, 10);
      if (isNaN(currentScore)) continue;

      const penalty = computeDecay(lastActivity, now);
      if (penalty < 0) {
        const newScore = Math.max(0, currentScore + penalty);
        if (newScore !== currentScore) {
          row.score = String(newScore);
          decayedCount++;
        }
      }
    }

    const output = toCsv(headers, rows);
    fs.writeFileSync(crmPath, output, 'utf-8');

    console.log(`[score-decay-activity] Finished: ${rows.length} leads processed, ${decayedCount} decayed`);
    return { processed: rows.length, decayed: decayedCount };
  }

  return { runScoreDecay };
}

module.exports = { createScoreDecayActivities };
