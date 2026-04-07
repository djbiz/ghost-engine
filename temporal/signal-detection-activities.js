const fs = require('fs');
const path = require('path');
const { getTemporalConfig } = require('./config');
const { createStateStore } = require('./state-store');
const { createObservability } = require('./observability');

/**
 * Signal detection activities.
 *
 * Replaces the logic from:
 *   - GHO-27 Agent 3 (Signal Detector: intent detection + human breakpoint)
 *   - GHO-29 Human Breakpoint Integration (automation pause + Derek alert)
 *   - scripts/automation-hot-lead-alert.js (hot lead escalation)
 *   - scripts/automation-speed-close.js (Stripe abandonment speed close)
 *   - scripts/speed-close-trigger.js (signal evaluation + tier recommendation)
 *
 * Signal keywords from the original GHO-27 spec.
 */

const INTENT_KEYWORDS = [
  'yeah',
  'we are struggling',
  'not really organized',
  'kinda messy',
  'this is interesting',
  'tell me more',
  'how does it work',
  'curious',
  'interested',
  'what does it cost',
  'send me details',
  'let\'s talk',
  'can we chat',
  'book a call',
  'i\'m in',
  'sign me up',
  'sounds good',
  'when can we start',
];

const SPEED_CLOSE_EVENT_TYPES = [
  'stripe_click',
  'pricing_ask',
  'call_booked',
  'replied_twice_in_24h',
];

const SPEED_CLOSE_DM = `Hey - I saw you checked the payment page.

Usually that means you're close.

What held you back?

Price? Time? Not sure it'll work?

I can probably help sort it out.

Still interested?`;

const SPEED_CLOSE_FOLLOWUP_2 = `Hey - following up.

You were close to getting started.

The offer's still available.

If the timing wasn't right - I get it.

Just don't want you sitting in the same spot 3 months from now.

Worth a quick chat?`;

function createSignalDetectionActivities(options = {}) {
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

  // ---------------------------------------------------------------
  // Activity: classifySignal
  // ---------------------------------------------------------------
  async function classifySignal(input = {}) {
    const { leadEmail, leadName, channel, eventType, messageBody } = input;

    observability.logger.info('signal.classify', {
      leadEmail, leadName, channel, eventType,
      bodyLength: (messageBody || '').length,
    });

    // Check for intent keywords in message body
    const bodyLower = (messageBody || '').toLowerCase();
    let matchedKeyword = null;
    let intentScore = 0;

    for (const keyword of INTENT_KEYWORDS) {
      if (bodyLower.includes(keyword)) {
        matchedKeyword = keyword;
        intentScore += 20;
      }
    }
    intentScore = Math.min(intentScore, 100);

    // Check for speed-close event types
    const isSpeedClose = SPEED_CLOSE_EVENT_TYPES.includes(eventType) ||
      bodyLower.includes('pricing') ||
      bodyLower.includes('cost') ||
      bodyLower.includes('how much');

    // Determine signal type
    let signalType = 'neutral';
    if (eventType === 'reply' && matchedKeyword) signalType = 'intent_reply';
    if (eventType === 'reply' && !matchedKeyword) signalType = 'reply_no_intent';
    if (eventType === 'stripe_click') signalType = 'stripe_abandonment';
    if (eventType === 'call_booked') signalType = 'call_booked';
    if (eventType === 'pricing_ask') signalType = 'pricing_inquiry';
    if (eventType === 'replied_twice_in_24h') signalType = 'rapid_engagement';

    // Hot = intent keyword match OR speed-close event OR high intent score
    const isHot = intentScore >= 40 || isSpeedClose || eventType === 'call_booked';

    // Confidence based on signal strength
    let confidence = 'low';
    if (intentScore >= 60 || eventType === 'call_booked') confidence = 'high';
    else if (intentScore >= 40 || isSpeedClose) confidence = 'medium';

    const classification = {
      leadEmail,
      leadName,
      channel,
      eventType,
      signalType,
      isHot,
      isSpeedClose,
      intentScore,
      matchedKeyword,
      confidence,
      classifiedAt: new Date().toISOString(),
    };

    observability.metrics.increment('signal.classified', 1, {
      signalType, isHot: String(isHot), confidence,
    });

    return classification;
  }

  // ---------------------------------------------------------------
  // Activity: triggerHumanBreakpoint
  //
  // GHO-29 spec: STOP all automation for this lead, alert Derek
  // via alert queue with lead name, signal quote, conversation context.
  // ---------------------------------------------------------------
  async function triggerHumanBreakpoint(input = {}) {
    const {
      leadEmail, leadName, channel, signalType,
      signalQuote, confidence,
    } = input;

    observability.logger.info('signal.humanBreakpoint', {
      leadName, leadEmail, signalType, confidence,
    });

    // Write to alert queue (picked up by closer agent / WhatsApp integration)
    const alertQueue = path.join(leadsDir, 'alert-queue.txt');
    const alertMessage = [
      `HOT LEAD: ${leadName || leadEmail}`,
      `Signal: "${signalQuote}"`,
      `Channel: ${channel}`,
      `Type: ${signalType}`,
      `Confidence: ${confidence}`,
      `Action: Reply to engage or say 'pass'`,
    ].join(' | ');

    fs.appendFileSync(alertQueue, `[${new Date().toISOString()}] ${alertMessage}\n`);

    // Mark in processed alerts so we don't double-alert
    const processedFile = path.join(leadsDir, 'alerts-processed.txt');
    const key = `${leadEmail || leadName}:signal:${signalType}`;
    fs.appendFileSync(processedFile, `${key}\n`);

    // Persist breakpoint state
    await store.set(`signal:breakpoint:${leadEmail || leadName}`, {
      leadEmail,
      leadName,
      channel,
      signalType,
      signalQuote,
      confidence,
      status: 'human_breakpoint',
      triggeredAt: new Date().toISOString(),
      automationPaused: true,
    });

    observability.metrics.increment('signal.humanBreakpoint.triggered', 1, {
      confidence, signalType,
    });

    return {
      triggered: true,
      leadName,
      leadEmail,
      alertMessage,
      automationPaused: true,
    };
  }

  // ---------------------------------------------------------------
  // Activity: queueSpeedCloseDM
  //
  // From automation-speed-close.js: when someone clicks Stripe but
  // doesn't buy, fire the speed close DM within 5 minutes.
  // ---------------------------------------------------------------
  async function queueSpeedCloseDM(input = {}) {
    const { leadEmail, leadName, channel, signalType } = input;

    observability.logger.info('signal.speedClose.queue', {
      leadName, leadEmail, signalType,
    });

    // Find lead in CRM to get platform/username
    const crmPath = path.join(leadsDir, 'crm.csv');
    const leads = readCsv(crmPath);
    const lead = leads.find((l) =>
      (leadEmail && l.email && l.email.toLowerCase() === leadEmail.toLowerCase()) ||
      (leadName && l.name && l.name.toLowerCase().includes(leadName.toLowerCase())),
    );

    const platform = (lead && lead.platform) || channel || 'linkedin';

    // Log to speed-close-log.csv
    const logPath = path.join(leadsDir, 'speed-close-log.csv');
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, 'timestamp,email,name,stage,platform,signal_type\n');
    }
    fs.appendFileSync(
      logPath,
      `${new Date().toISOString()},${leadEmail || ''},${leadName || ''},dm_queued,${platform},${signalType}\n`,
    );

    // Persist to state store for the outreach system to pick up
    await store.set(`signal:speedClose:${leadEmail || leadName}`, {
      leadEmail,
      leadName,
      platform,
      signalType,
      message: SPEED_CLOSE_DM,
      followUp: SPEED_CLOSE_FOLLOWUP_2,
      queuedAt: new Date().toISOString(),
      status: 'queued',
    });

    observability.metrics.increment('signal.speedClose.queued', 1, {
      platform, signalType,
    });

    return {
      queued: true,
      leadName,
      leadEmail,
      platform,
      signalType,
      message: SPEED_CLOSE_DM.slice(0, 60) + '...',
    };
  }

  // ---------------------------------------------------------------
  // Activity: updateOutboundChainState
  //
  // When a signal fires, update the outbound chain state for this lead
  // so scheduled sequence steps can adapt (e.g. skip nurture if they
  // already replied with intent).
  // ---------------------------------------------------------------
  async function updateOutboundChainState(input = {}) {
    const { leadEmail, issueId, classification } = input;

    // Try to find existing outbound chain state
    const chainKey = issueId
      ? `outbound:sequence:${issueId}`
      : null;

    let chainState = null;
    if (chainKey) {
      chainState = await store.get(chainKey);
    }

    // If no chain state by issueId, try by lead email
    if (!chainState && leadEmail) {
      const leadKey = `outbound:lead:${leadEmail}`;
      const leadState = await store.get(leadKey);
      if (leadState && leadState.issueId) {
        chainState = await store.get(`outbound:sequence:${leadState.issueId}`);
      }
    }

    if (chainState) {
      // Update the chain state with signal info
      const updatedState = {
        ...chainState,
        signalDetected: true,
        signalType: classification.signalType,
        signalConfidence: classification.confidence,
        signalAt: new Date().toISOString(),
        automationPaused: classification.isHot,
      };

      // If hot signal, mark remaining scheduled steps as paused
      if (classification.isHot && updatedState.steps) {
        updatedState.steps = updatedState.steps.map((step) => {
          if (step.status === 'scheduled') {
            return { ...step, status: 'paused_signal_detected' };
          }
          return step;
        });
      }

      await store.set(`outbound:sequence:${chainState.issueId}`, updatedState);

      observability.logger.info('signal.chainState.updated', {
        issueId: chainState.issueId,
        signalType: classification.signalType,
        paused: classification.isHot,
      });
    }

    observability.metrics.increment('signal.chainState.update', 1, {
      found: String(!!chainState),
      paused: String(classification.isHot),
    });

    return {
      updated: !!chainState,
      issueId: chainState?.issueId || issueId,
      paused: classification.isHot,
    };
  }

  // ---------------------------------------------------------------
  // Activity: scanForNewSignals
  //
  // Batch scan: check CRM and lead files for new reply events
  // that haven't been processed yet. This is the cron-mode scanner.
  // ---------------------------------------------------------------
  async function scanForNewSignals(input = {}) {
    const channels = input.channels || ['linkedin', 'email'];

    observability.logger.info('signal.scan.start', { channels });

    const signals = [];

    // Check CRM for leads that replied since last scan
    const crmPath = path.join(leadsDir, 'crm.csv');
    const leads = readCsv(crmPath);

    // Load last scan timestamp
    const lastScanState = await store.get('signal:lastScan') || {};
    const lastScanAt = lastScanState.scannedAt
      ? Date.parse(lastScanState.scannedAt)
      : 0;

    for (const lead of leads) {
      const replied = (lead.replied || lead.reply || '').toLowerCase();
      const status = (lead.status || '').toLowerCase();
      const lastReply = lead.last_reply || lead.reply_date || lead.lastReply;
      const replyMs = lastReply ? Date.parse(lastReply) : NaN;

      // Only pick up replies newer than last scan
      if (replied === 'yes' || replied === 'true' || status === 'replied') {
        if (Number.isFinite(replyMs) && replyMs > lastScanAt) {
          signals.push({
            name: lead.name,
            email: lead.email,
            channel: lead.platform || 'linkedin',
            eventType: 'reply',
            messageBody: lead.reply_text || lead.last_message || '',
            score: Number(lead.score || lead.lead_score || 0),
          });
        }
      }

      // Check for speed-close signals in status
      if (status === 'stripe_clicked' || status === 'pricing_asked') {
        signals.push({
          name: lead.name,
          email: lead.email,
          channel: 'stripe',
          eventType: status === 'stripe_clicked' ? 'stripe_click' : 'pricing_ask',
          messageBody: '',
          score: Number(lead.score || lead.lead_score || 0),
        });
      }
    }

    // Check discovery calls for newly booked
    const discoveryPath = path.join(leadsDir, 'discovery-calls.csv');
    const calls = readCsv(discoveryPath);

    // Track which call bookings we've already processed
    const processedFile = path.join(leadsDir, 'alerts-processed.txt');
    const processedRaw = fs.existsSync(processedFile)
      ? fs.readFileSync(processedFile, 'utf8')
      : '';

    for (const call of calls) {
      if (call.status === 'booked' || call.status === 'confirmed') {
        const key = `${call.email || call.name}:signal:call_booked`;
        if (!processedRaw.includes(key)) {
          signals.push({
            name: call.name,
            email: call.email,
            channel: 'calendly',
            eventType: 'call_booked',
            messageBody: '',
            score: 90,
          });
        }
      }
    }

    // Update last scan timestamp
    await store.set('signal:lastScan', {
      scannedAt: new Date().toISOString(),
      signalsFound: signals.length,
    });

    observability.logger.info('signal.scan.complete', {
      signalsFound: signals.length,
      channels,
    });
    observability.metrics.increment('signal.scan.completed', 1, {
      found: String(signals.length),
    });

    return {
      signals,
      scannedAt: new Date().toISOString(),
      channels,
    };
  }

  // ---------------------------------------------------------------
  // Activity: persistScanSummary
  // ---------------------------------------------------------------
  async function persistScanSummary(input = {}) {
    const {
      scanResult, classified, breakpoints, speedCloses,
      workflowId, runId, startedAt,
    } = input;

    const summary = {
      workflowId,
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      signalsScanned: scanResult.signals.length,
      classified: classified.length,
      hotSignals: classified.filter((c) => c.classification.isHot).length,
      speedCloseSignals: classified.filter((c) => c.classification.isSpeedClose).length,
      breakpointsTriggered: breakpoints.length,
      speedClosesQueued: speedCloses.length,
    };

    await store.set(`signal:scanSummary:${Date.now()}`, summary);

    observability.logger.info('signal.scanSummary', summary);
    observability.metrics.increment('signal.scanSummary.persisted', 1);

    return summary;
  }

  return {
    classifySignal,
    triggerHumanBreakpoint,
    queueSpeedCloseDM,
    updateOutboundChainState,
    scanForNewSignals,
    persistScanSummary,
  };
}

module.exports = {
  createSignalDetectionActivities,
  INTENT_KEYWORDS,
  SPEED_CLOSE_EVENT_TYPES,
};
