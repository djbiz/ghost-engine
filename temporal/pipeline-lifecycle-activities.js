const fs = require('fs');
const path = require('path');
const { getTemporalConfig } = require('./config');
const { createStateStore } = require('./state-store');
const { createObservability } = require('./observability');

/**
 * Pipeline lifecycle activities.
 *
 * Replaces the logic from:
 *   - scripts/pipeline-automation.js (hourly cron)
 *   - scripts/automation-hot-lead-alert.js (escalation)
 *   - scripts/speed-close-trigger.js (speed close detection)
 *
 * All file I/O uses the same CSV/JSONL paths as the legacy scripts
 * so the cutover is seamless.
 */

const HOT_SIGNALS = [
  'clicked_stripe_link',
  'replied_twice_in_24h',
  'asked_about_pricing',
  'visited_sales_page',
  'opened_3_emails_in_row',
  'booked_call',
];

const CLOSE_TIERS = {
  quick_flip: { price: 990, name: 'Quick Flip', urgency: 'high', timeline: '48 hours' },
  full_engine: { price: 4970, name: 'Full Engine Install', urgency: 'medium', timeline: '14 days' },
  ghost_partner: { price: 9700, name: 'Ghost Partner Retainer', urgency: 'low', timeline: '30 days' },
};

function readCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim(); });
    return obj;
  });
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const parsed = JSON.parse(line);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
}

function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function createPipelineLifecycleActivities(options = {}) {
  const config = getTemporalConfig(options.config || {});
  const observability = options.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });
  const store = options.stateStore || createStateStore({
    filePath: config.statePath,
    namespace: config.namespace,
    logger: observability.logger,
  });

  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const leadsDir = path.join(rootDir, 'leads');
  const scriptsDir = path.join(rootDir, 'scripts');

  function getPaths() {
    return {
      crm: path.join(leadsDir, 'crm.csv'),
      inbound: path.join(leadsDir, 'inbound.csv'),
      discovery: path.join(leadsDir, 'discovery-calls.csv'),
      closeLog: path.join(rootDir, 'close-log.jsonl'),
      scriptCloseLog: path.join(scriptsDir, 'close-log.jsonl'),
      alertQueue: path.join(leadsDir, 'alert-queue.txt'),
      alertsProcessed: path.join(leadsDir, 'alerts-processed.txt'),
      speedCloseLog: path.join(leadsDir, 'speed-close-log.csv'),
    };
  }

  // ---------------------------------------------------------------
  // Activity: capturePipelineSnapshot
  // ---------------------------------------------------------------
  async function capturePipelineSnapshot(input = {}) {
    const paths = getPaths();
    const date = input.date || new Date().toISOString().slice(0, 10);
    const now = Date.now();

    const crmRows = readCsv(paths.crm);
    const inboundRows = readCsv(paths.inbound);
    const discoveryRows = readCsv(paths.discovery);

    const closeLogPath = fs.existsSync(paths.closeLog) ? paths.closeLog : paths.scriptCloseLog;
    const closeEntries = readJsonLines(closeLogPath);

    // Classify leads
    const hotLeads = crmRows.filter((l) => {
      const score = toNumber(l.score || l.lead_score || l.fit_score);
      const status = (l.status || '').toLowerCase();
      return status === 'hot' || score >= 85;
    });

    const staleLeads = crmRows.filter((l) => {
      const lastContact = l.last_contact || l.lastContact || l.last_contact_at;
      const status = (l.status || '').toLowerCase();
      const ms = lastContact ? Date.parse(lastContact) : NaN;
      return status && !status.startsWith('closed') && Number.isFinite(ms) && now - ms >= 48 * 60 * 60 * 1000;
    });

    const newLeads = inboundRows.filter((l) => (l.status || '').toLowerCase() === 'new');

    // CRM status counts
    const statusCounts = {};
    crmRows.forEach((l) => {
      const s = (l.status || 'unknown').toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const snapshot = {
      date,
      capturedAt: new Date().toISOString(),
      leadCount: crmRows.length,
      inboundCount: inboundRows.length,
      newLeadCount: newLeads.length,
      hotLeadCount: hotLeads.length,
      staleLeadCount: staleLeads.length,
      callCount: discoveryRows.length,
      closeCount: closeEntries.length,
      statusCounts,
      hotLeads: hotLeads.map((l) => ({
        name: l.name, email: l.email, score: toNumber(l.score || l.lead_score || l.fit_score),
        platform: l.platform, status: l.status,
      })),
      staleLeads: staleLeads.map((l) => ({
        name: l.name, email: l.email, lastContact: l.last_contact || l.lastContact,
        status: l.status,
      })),
      newLeads: newLeads.map((l) => ({
        name: l.name, email: l.email, platform: l.platform,
      })),
      discoveryCalls: discoveryRows.map((c) => ({
        name: c.name, email: c.email, status: c.status,
        confirmedTime: c.confirmed_time || null,
      })),
    };

    observability.logger.info('pipeline.snapshot', {
      date, leads: snapshot.leadCount, hot: snapshot.hotLeadCount,
      stale: snapshot.staleLeadCount, calls: snapshot.callCount, closes: snapshot.closeCount,
    });
    observability.metrics.increment('pipeline.snapshot.captured', 1);

    return snapshot;
  }

  // ---------------------------------------------------------------
  // Activity: scoreInboundLeads
  // ---------------------------------------------------------------
  async function scoreInboundLeads(input = {}) {
    const { snapshot } = input;
    const actions = [];

    if (snapshot.newLeadCount > 10) {
      actions.push('10+ new leads unprocessed - trigger scoring now');
    }
    if (snapshot.newLeadCount > 0) {
      actions.push(`Score ${snapshot.newLeadCount} new inbound leads and queue first-touch outreach`);
    }

    observability.metrics.increment('pipeline.scoring.run', 1, {
      newLeads: String(snapshot.newLeadCount),
    });

    return {
      newLeadsScored: snapshot.newLeadCount,
      actions,
    };
  }

  // ---------------------------------------------------------------
  // Activity: detectStaleLeads
  // ---------------------------------------------------------------
  async function detectStaleLeads(input = {}) {
    const { snapshot, staleThresholdHours } = input;
    const actions = [];

    if (snapshot.staleLeadCount > 0) {
      actions.push(`Re-engage ${snapshot.staleLeadCount} stale leads (${staleThresholdHours}h+ no contact)`);
    }

    observability.metrics.increment('pipeline.stale.detected', snapshot.staleLeadCount);

    return {
      staleCount: snapshot.staleLeadCount,
      staleLeads: snapshot.staleLeads,
      actions,
    };
  }

  // ---------------------------------------------------------------
  // Activity: escalateHotLeads
  // ---------------------------------------------------------------
  async function escalateHotLeads(input = {}) {
    const { snapshot, hotThreshold } = input;
    const paths = getPaths();
    const alerts = [];

    // Load already-processed alerts
    const processedRaw = fs.existsSync(paths.alertsProcessed)
      ? fs.readFileSync(paths.alertsProcessed, 'utf8')
      : '';

    for (const lead of snapshot.hotLeads) {
      const key = `${lead.email || lead.name}:hot-lead`;
      if (processedRaw.includes(key)) continue;

      const alert = {
        type: 'hot_lead',
        name: lead.name,
        email: lead.email,
        score: lead.score,
        platform: lead.platform,
        message: `HOT LEAD: ${lead.name} - ${lead.platform || '?'}, score ${lead.score}. Immediate follow-up needed.`,
        timestamp: new Date().toISOString(),
      };
      alerts.push(alert);

      // Write to alert queue
      fs.appendFileSync(paths.alertQueue, `[${alert.timestamp}] ${alert.message}\n`);
      // Mark as alerted
      fs.appendFileSync(paths.alertsProcessed, `${key}\n`);
    }

    observability.metrics.increment('pipeline.hotLead.escalated', alerts.length);
    if (alerts.length > 0) {
      observability.logger.info('pipeline.hotLeads.escalated', {
        count: alerts.length,
        leads: alerts.map((a) => a.name),
      });
    }

    return {
      hotCount: snapshot.hotLeadCount,
      alerts,
      newAlerts: alerts.length,
    };
  }

  // ---------------------------------------------------------------
  // Activity: checkDiscoveryCalls
  // ---------------------------------------------------------------
  async function checkDiscoveryCalls(input = {}) {
    const { snapshot } = input;
    const actions = [];

    for (const call of snapshot.discoveryCalls) {
      if (call.status === 'booked' && !call.confirmedTime) {
        actions.push(`Follow up: ${call.name || call.email} - confirm call time`);
      }
      if (call.status === 'completed' && !call.closed) {
        actions.push(`Close follow up: ${call.name || call.email} - get decision`);
      }
    }

    observability.metrics.increment('pipeline.calls.checked', snapshot.callCount);

    return {
      callCount: snapshot.callCount,
      actions,
    };
  }

  // ---------------------------------------------------------------
  // Activity: detectSpeedCloseSignals
  // ---------------------------------------------------------------
  async function detectSpeedCloseSignals(input = {}) {
    const { snapshot } = input;
    const triggers = [];

    // Check hot leads for speed-close signal patterns
    for (const lead of snapshot.hotLeads) {
      const signals = (lead.signals || '').split(',').map((s) => s.trim()).filter(Boolean);
      const hotSignalCount = signals.filter((s) => HOT_SIGNALS.includes(s)).length;
      const score = toNumber(lead.score);

      if (hotSignalCount >= 2 || score >= 90) {
        // Recommend tier based on signals
        let tier = CLOSE_TIERS.ghost_partner;
        if (signals.includes('clicked_stripe_link') || signals.includes('asked_about_pricing')) {
          tier = CLOSE_TIERS.quick_flip;
        } else if (score >= 90 || signals.includes('booked_call')) {
          tier = CLOSE_TIERS.full_engine;
        }

        triggers.push({
          name: lead.name,
          email: lead.email,
          score,
          hotSignals: hotSignalCount,
          recommendedTier: tier.name,
          price: tier.price,
          timeline: tier.timeline,
          timestamp: new Date().toISOString(),
        });
      }
    }

    if (triggers.length > 0) {
      observability.logger.info('pipeline.speedClose.detected', {
        count: triggers.length,
        leads: triggers.map((t) => t.name),
      });
    }
    observability.metrics.increment('pipeline.speedClose.triggered', triggers.length);

    // Pipeline fullness checks (from original pipeline-automation.js)
    const actions = [];
    if ((snapshot.statusCounts.qualified || 0) > 20) {
      actions.push('Pipeline is full - focus on closes not new leads');
    }
    if ((snapshot.statusCounts.proposal || 0) > 5) {
      actions.push('Multiple proposals out - check in on decisions');
    }

    return {
      triggered: triggers.length > 0,
      triggers,
      actions,
    };
  }

  // ---------------------------------------------------------------
  // Activity: evaluateProofLoopTrigger
  // ---------------------------------------------------------------
  async function evaluateProofLoopTrigger(input = {}) {
    const { snapshot, closeThreshold } = input;
    const triggered = snapshot.closeCount >= closeThreshold;
    const actions = [];

    if (triggered) {
      actions.push(`${snapshot.closeCount} closes reached - trigger proof loop immediately`);
    }

    observability.metrics.increment('pipeline.proofLoop.evaluated', 1, {
      closes: String(snapshot.closeCount),
      triggered: String(triggered),
    });

    return {
      triggered,
      closeCount: snapshot.closeCount,
      threshold: closeThreshold,
      actions,
    };
  }

  // ---------------------------------------------------------------
  // Activity: persistPipelineSummary
  // ---------------------------------------------------------------
  async function persistPipelineSummary(input = {}) {
    const {
      snapshot, scoring, staleResult, escalation,
      callCheck, speedClose, proofCheck,
      workflowId, runId, startedAt,
    } = input;

    // Collect all actions from every step
    const actions = [
      ...scoring.actions,
      ...staleResult.actions,
      ...callCheck.actions,
      ...speedClose.actions,
      ...proofCheck.actions,
    ];

    if (actions.length === 0) {
      actions.push('Pipeline healthy - no urgent actions');
    }

    const summary = {
      date: snapshot.date,
      workflowId,
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      leadCount: snapshot.leadCount,
      hotLeadCount: snapshot.hotLeadCount,
      staleLeadCount: snapshot.staleLeadCount,
      callCount: snapshot.callCount,
      closeCount: snapshot.closeCount,
      newAlerts: escalation.newAlerts,
      speedCloseTriggers: speedClose.triggers.length,
      proofLoopTriggered: proofCheck.triggered,
      actions,
    };

    // Persist to state store
    await store.set(`pipeline:summary:${snapshot.date}:${Date.now()}`, summary);

    observability.logger.info('pipeline.summary', {
      date: snapshot.date,
      leads: snapshot.leadCount,
      hot: snapshot.hotLeadCount,
      stale: snapshot.staleLeadCount,
      actions: actions.length,
    });
    observability.metrics.increment('pipeline.lifecycle.completed', 1);

    return summary;
  }

  return {
    capturePipelineSnapshot,
    scoreInboundLeads,
    detectStaleLeads,
    escalateHotLeads,
    checkDiscoveryCalls,
    detectSpeedCloseSignals,
    evaluateProofLoopTrigger,
    persistPipelineSummary,
  };
}

module.exports = {
  createPipelineLifecycleActivities,
  HOT_SIGNALS,
  CLOSE_TIERS,
};
