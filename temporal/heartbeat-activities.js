const fs = require('fs');
const path = require('path');
const { getTemporalConfig } = require('./config');
const { createObservability } = require('./observability');

function todayISO(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function readTextFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeTextFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function parseCsv(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/);
  const headers = lines.shift().split(',').map((header) => header.trim());

  return lines
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',');
      return headers.reduce((row, header, index) => {
        row[header] = (values[index] || '').trim();
        return row;
      }, {});
    });
}

function readCsv(filePath) {
  const raw = readTextFile(filePath);
  return raw ? parseCsv(raw) : [];
}

function readJson(filePath, fallback = null) {
  const raw = readTextFile(filePath);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function readJsonLines(filePath) {
  const raw = readTextFile(filePath);
  if (!raw) {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        return [];
      }
    });
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatSummaryLines(summary) {
  return [
    `Date: ${summary.date}`,
    `Beat: ${summary.beat}`,
    `Leads: ${summary.leadCount}`,
    `Hot leads: ${summary.hotLeadCount}`,
    `Stale leads: ${summary.staleLeadCount}`,
    `Calls booked: ${summary.callCount}`,
    `Closes: ${summary.closeCount}`,
    `Revenue: $${summary.revenue}`,
  ];
}

function buildActionPlan(beat, summary) {
  const actions = [];

  if (beat === 'morning') {
    if (summary.newLeadCount > 0) {
      actions.push('score fresh inbound leads and queue first-touch outreach');
    }
    if (summary.staleLeadCount > 0) {
      actions.push('re-engage stale leads that crossed the 48h window');
    }
  }

  if (beat === 'closer') {
    if (summary.hotLeadCount > 0) {
      actions.push('push hot leads toward call booking and decision');
    }
    if (summary.callCount > 0) {
      actions.push('prepare call briefs for booked discovery calls');
    }
  }

  if (beat === 'fulfillment') {
    if (summary.closeCount > 0) {
      actions.push('turn new closes into proof, case studies, and delivery tasks');
    }
    if (summary.revenue > 0) {
      actions.push('mirror wins into the daily proof loop and social assets');
    }
  }

  if (beat === 'nightly') {
    actions.push('write the daily summary and carry the state forward');
    if (summary.closeCount > 0 || summary.callCount > 0) {
      actions.push('sync CRM, metrics, and nightly notes before shutdown');
    }
  }

  if (beat === 'sync') {
    actions.push('reconcile lead, close, and metrics snapshots');
    actions.push('refresh the durable state file and heartbeat log');
  }

  return actions;
}

function createHeartbeatActivities(options = {}) {
  const config = getTemporalConfig(options.config || {});
  const observability = options.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });

  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const dataDir = path.join(rootDir, 'data');
  const dailyDir = path.join(rootDir, 'daily');
  const leadsDir = path.join(rootDir, 'leads');
  const systemDir = path.join(rootDir, 'system');

  function getSnapshotPaths() {
    return {
      crm: path.join(leadsDir, 'crm.csv'),
      inbound: path.join(leadsDir, 'inbound.csv'),
      discovery: path.join(leadsDir, 'discovery-calls.csv'),
      dailyHuntLog: path.join(leadsDir, 'daily-hunt-log.csv'),
      closeLog: path.join(rootDir, 'close-log.jsonl'),
      scriptCloseLog: path.join(rootDir, 'scripts', 'close-log.jsonl'),
      metrics: path.join(leadsDir, 'metrics-snapshot.txt'),
      dailyTemplate: path.join(dailyDir, 'TEMPLATE.md'),
      slog: path.join(rootDir, 'slog.jsonl'),
      heartbeatState: path.join(dataDir, 'temporal-heartbeat-state.json'),
      heartbeatSystem: path.join(systemDir, 'HEARTBEAT.md'),
    };
  }

  function getCloseLogPath(paths) {
    return fs.existsSync(paths.closeLog) ? paths.closeLog : paths.scriptCloseLog;
  }

  async function captureOperationalSnapshot(input = {}) {
    const beat = input.beat || 'sync';
    const date = input.date || todayISO();
    const paths = getSnapshotPaths();
    const crmRows = readCsv(paths.crm);
    const inboundRows = readCsv(paths.inbound);
    const discoveryRows = readCsv(paths.discovery);
    const huntRows = readCsv(paths.dailyHuntLog);
    const closeEntries = readJsonLines(getCloseLogPath(paths));
    const metrics = readJson(paths.metrics, {});
    const heartbeatSystem = readTextFile(paths.heartbeatSystem) || '';

    const now = Date.now();
    const staleLeads = crmRows.filter((lead) => {
      const lastContact = lead.last_contact || lead.lastContact || lead.last_contact_at;
      const status = String(lead.status || '').toLowerCase();
      const lastContactMs = lastContact ? Date.parse(lastContact) : NaN;
      return status && !status.startsWith('closed') && Number.isFinite(lastContactMs) && now - lastContactMs >= 48 * 60 * 60 * 1000;
    });

    const hotLeads = crmRows.filter((lead) => {
      const status = String(lead.status || '').toLowerCase();
      const score = toNumber(lead.score || lead.lead_score || lead.fit_score);
      return status === 'hot' || score >= 80;
    });

    const qualifiedLeads = crmRows.filter((lead) => {
      const status = String(lead.status || '').toLowerCase();
      const score = toNumber(lead.score || lead.lead_score || lead.fit_score);
      return score >= 60 || ['hot', 'qualified', 'contacted', 'proposal'].includes(status);
    });

    const callCount = discoveryRows.filter((call) => {
      const status = String(call.status || '').toLowerCase();
      return status === 'booked' || status === 'completed';
    }).length;

    const todayLeadCount = crmRows.filter((lead) => {
      const timestamp = lead.timestamp || lead.created_at || lead.createdAt || '';
      return timestamp.includes(date);
    }).length;

    const revenue = toNumber(metrics.revenue || metrics.closedRevenue || metrics.totalRevenue);
    const closeCount = closeEntries.length;

    const summary = {
      beat,
      date,
      generatedAt: new Date().toISOString(),
      leadCount: crmRows.length,
      inboundCount: inboundRows.length,
      callCount,
      closeCount,
      revenue,
      hotLeadCount: hotLeads.length,
      staleLeadCount: staleLeads.length,
      qualifiedLeadCount: qualifiedLeads.length,
      newLeadCount: todayLeadCount,
      huntCount: huntRows.length,
      statusFootprint: {
        heartbeatChars: heartbeatSystem.length,
        dailyTemplateExists: fs.existsSync(paths.dailyTemplate),
      },
    };

    summary.actionPlan = buildActionPlan(beat, summary);
    summary.dailyLines = formatSummaryLines(summary);
    summary.staleLeads = staleLeads.slice(0, 10);
    summary.hotLeads = hotLeads.slice(0, 10);
    summary.latestCloseEntries = closeEntries.slice(-10);

    observability.metrics.increment('heartbeat.snapshot.captured', 1, {
      beat,
      namespace: config.namespace,
    });

    return summary;
  }

  async function ensureDailyNote(input = {}) {
    const date = input.date || todayISO();
    const paths = getSnapshotPaths();
    const dailyPath = path.join(dailyDir, `${date}.md`);

    if (!fs.existsSync(paths.dailyTemplate)) {
      return { date, created: false, path: dailyPath, reason: 'missing-template' };
    }

    if (!fs.existsSync(dailyPath)) {
      let content = readTextFile(paths.dailyTemplate) || '';
      content = content.replace(/2026-03-29/g, date).replace(/2026-03-28/g, date);
      content = content.replace(/\{\{DATE\}\}/g, date);
      writeTextFile(dailyPath, content);
      observability.metrics.increment('heartbeat.daily.created', 1, { date });
      return { date, created: true, path: dailyPath };
    }

    return { date, created: false, path: dailyPath };
  }

  async function syncMetricsSnapshot(input = {}) {
    const summary = input.summary || (await captureOperationalSnapshot(input));
    const paths = getSnapshotPaths();
    const metricsPayload = {
      date: summary.date,
      beat: summary.beat,
      leadCount: summary.leadCount,
      inboundCount: summary.inboundCount,
      callCount: summary.callCount,
      closeCount: summary.closeCount,
      revenue: summary.revenue,
      hotLeadCount: summary.hotLeadCount,
      staleLeadCount: summary.staleLeadCount,
      qualifiedLeadCount: summary.qualifiedLeadCount,
      generatedAt: summary.generatedAt,
    };

    writeTextFile(paths.metrics, `${JSON.stringify(metricsPayload, null, 2)}\n`);
    observability.metrics.increment('heartbeat.metrics.synced', 1, {
      beat: summary.beat,
      namespace: config.namespace,
    });

    return metricsPayload;
  }

  async function appendHeartbeatLog(input = {}) {
    const summary = input.summary || (await captureOperationalSnapshot(input));
    const paths = getSnapshotPaths();
    const entry = {
      ts: new Date().toISOString(),
      event: 'temporal-heartbeat',
      beat: input.beat || summary.beat,
      workflowId: input.workflowId || null,
      runId: input.runId || null,
      summary: {
        date: summary.date,
        leadCount: summary.leadCount,
        hotLeadCount: summary.hotLeadCount,
        staleLeadCount: summary.staleLeadCount,
        callCount: summary.callCount,
        closeCount: summary.closeCount,
        revenue: summary.revenue,
      },
      actionPlan: summary.actionPlan || [],
    };

    fs.mkdirSync(path.dirname(paths.slog), { recursive: true });
    fs.appendFileSync(paths.slog, `${JSON.stringify(entry)}\n`, 'utf8');
    observability.metrics.increment('heartbeat.log.appended', 1, {
      beat: entry.beat,
      namespace: config.namespace,
    });

    return entry;
  }

  async function syncHeartbeatState(input = {}) {
    const summary = input.summary || (await captureOperationalSnapshot(input));
    const paths = getSnapshotPaths();
    const state = {
      ...summary,
      heartbeatStateVersion: 3,
      workflowId: input.workflowId || null,
      runId: input.runId || null,
      source: 'temporal',
      updatedAt: new Date().toISOString(),
      dailyNotePath: input.dailyNote?.path || null,
      dailyNoteCreated: Boolean(input.dailyNote?.created),
    };

    writeTextFile(paths.heartbeatState, `${JSON.stringify(state, null, 2)}\n`);
    observability.metrics.increment('heartbeat.state.synced', 1, {
      beat: summary.beat,
      namespace: config.namespace,
    });

    return state;
  }

  async function enrichDailyNote(input = {}) {
    const summary = input.summary || (await captureOperationalSnapshot(input));
    const dailyNote = input.dailyNote || (await ensureDailyNote({ date: summary.date }));
    const notePath = dailyNote.path;
    const content = readTextFile(notePath);

    if (!content) {
      return { ...dailyNote, updated: false };
    }

    const marker = '## Temporal Heartbeat';
    const block = [
      marker,
      '',
      ...summary.dailyLines.map((line) => `- ${line}`),
      '',
      '### Action Plan',
      ...summary.actionPlan.map((action) => `- ${action}`),
      '',
    ].join('\n');

    let nextContent;
    if (content.includes(marker)) {
      const start = content.indexOf(marker);
      const end = content.indexOf('\n## ', start + marker.length);
      if (end === -1) {
        nextContent = content.slice(0, start) + block;
      } else {
        nextContent = content.slice(0, start) + block + content.slice(end);
      }
    } else {
      nextContent = `${content.trimEnd()}\n\n${block}`;
    }

    writeTextFile(notePath, nextContent);
    observability.metrics.increment('heartbeat.daily.enriched', 1, {
      beat: summary.beat,
      namespace: config.namespace,
    });

    return { ...dailyNote, updated: true };
  }

  return {
    captureOperationalSnapshot,
    ensureDailyNote,
    syncMetricsSnapshot,
    appendHeartbeatLog,
    syncHeartbeatState,
    enrichDailyNote,
  };
}

module.exports = {
  createHeartbeatActivities,
};
