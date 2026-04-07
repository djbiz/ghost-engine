const { proxyActivities, workflowInfo } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const signalActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '10 minutes', heartbeatTimeout: '30 seconds' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

const linearActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '5 minutes' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

/**
 * signalDetectionWorkflow
 *
 * Detects buying signals and replies across channels, then:
 *   - Flags hot leads for Derek (human breakpoint - GHO-29)
 *   - Updates the outbound chain state so scheduled steps can adapt
 *   - Moves the Linear issue to the appropriate next state
 *   - Queues speed-close DMs when Stripe/pricing signals fire
 *
 * Can run two ways:
 *   A) On a cron schedule (every 2h, like the original Agent 3 spec in GHO-27)
 *      scanning inbox/CRM for new reply events
 *   B) On-demand, triggered by a webhook (e.g. LinkedIn reply webhook,
 *      Stripe checkout.session event, HubSpot deal stage change)
 *
 * The original Agent 3 (GHO-27) signal keywords:
 *   "yeah", "we are struggling", "not really organized", "kinda messy",
 *   "this is interesting", "tell me more", "how does it work", "curious",
 *   "interested"
 *
 * Input shape:
 *   {
 *     mode:       'scan' | 'event'
 *     // For mode='event' (single lead event):
 *     leadEmail:  string
 *     leadName:   string
 *     channel:    string   - 'linkedin' | 'email' | 'stripe' | 'hubspot'
 *     eventType:  string   - 'reply' | 'stripe_click' | 'call_booked' | 'pricing_ask'
 *     messageBody: string  - the raw reply text (for keyword scanning)
 *     issueId:    string   - Linear issue ID (optional)
 *     issueIdentifier: string
 *     // For mode='scan' (batch scan):
 *     scanChannels: string[]  - channels to scan, default all
 *     metadata:   object
 *   }
 */
async function signalDetectionWorkflow(input = {}) {
  const info = workflowInfo();
  const startedAt = new Date().toISOString();
  const mode = input.mode || 'scan';

  if (mode === 'event') {
    return await handleSingleEvent(input, info, startedAt);
  }

  return await handleBatchScan(input, info, startedAt);
}

async function handleSingleEvent(input, info, startedAt) {
  // --- Step 1: Classify the signal ---
  const classification = await signalActivities.classifySignal({
    leadEmail: input.leadEmail,
    leadName: input.leadName,
    channel: input.channel,
    eventType: input.eventType,
    messageBody: input.messageBody,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 2: If hot signal, trigger human breakpoint ---
  let breakpoint = null;
  if (classification.isHot) {
    breakpoint = await signalActivities.triggerHumanBreakpoint({
      leadEmail: input.leadEmail,
      leadName: input.leadName,
      channel: input.channel,
      signalType: classification.signalType,
      signalQuote: classification.matchedKeyword || input.messageBody,
      confidence: classification.confidence,
      workflowId: info.workflowId,
      runId: info.runId,
    });
  }

  // --- Step 3: If speed-close signal, queue accelerated DM ---
  let speedClose = null;
  if (classification.isSpeedClose) {
    speedClose = await signalActivities.queueSpeedCloseDM({
      leadEmail: input.leadEmail,
      leadName: input.leadName,
      channel: input.channel,
      signalType: classification.signalType,
      workflowId: info.workflowId,
      runId: info.runId,
    });
  }

  // --- Step 4: Update outbound chain state ---
  const stateUpdate = await signalActivities.updateOutboundChainState({
    leadEmail: input.leadEmail,
    issueId: input.issueId,
    classification,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 5: Update Linear issue if we have one ---
  let linearResult = null;
  if (input.issueId && classification.isHot) {
    linearResult = await linearActivities.postLinearComment({
      issueId: input.issueId,
      body: [
        `## Signal Detected - ${classification.signalType}`,
        '',
        `**Lead:** ${input.leadName || input.leadEmail}`,
        `**Channel:** ${input.channel}`,
        `**Signal:** ${classification.matchedKeyword || classification.signalType}`,
        `**Confidence:** ${classification.confidence}`,
        classification.isHot ? '**Action:** HUMAN BREAKPOINT - Derek alerted' : '',
        classification.isSpeedClose ? '**Action:** Speed close DM queued' : '',
        '',
        `---`,
        `*Temporal signal detection \`${info.workflowId}\`*`,
      ].filter(Boolean).join('\n'),
    });
  }

  return {
    status: 'completed',
    mode: 'event',
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    classification,
    breakpoint,
    speedClose,
    stateUpdate,
    linearResult,
  };
}

async function handleBatchScan(input, info, startedAt) {
  // --- Step 1: Scan CRM for new reply events ---
  const scanResult = await signalActivities.scanForNewSignals({
    channels: input.scanChannels || ['linkedin', 'email'],
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 2: Classify each detected signal ---
  const classified = [];
  for (const signal of scanResult.signals) {
    const classification = await signalActivities.classifySignal({
      leadEmail: signal.email,
      leadName: signal.name,
      channel: signal.channel,
      eventType: signal.eventType,
      messageBody: signal.messageBody,
      workflowId: info.workflowId,
      runId: info.runId,
    });

    classified.push({ signal, classification });
  }

  // --- Step 3: Process hot signals ---
  const hotSignals = classified.filter((c) => c.classification.isHot);
  const breakpoints = [];

  for (const { signal, classification } of hotSignals) {
    const bp = await signalActivities.triggerHumanBreakpoint({
      leadEmail: signal.email,
      leadName: signal.name,
      channel: signal.channel,
      signalType: classification.signalType,
      signalQuote: classification.matchedKeyword || signal.messageBody,
      confidence: classification.confidence,
      workflowId: info.workflowId,
      runId: info.runId,
    });
    breakpoints.push(bp);
  }

  // --- Step 4: Process speed-close signals ---
  const speedCloseSignals = classified.filter((c) => c.classification.isSpeedClose);
  const speedCloses = [];

  for (const { signal, classification } of speedCloseSignals) {
    const sc = await signalActivities.queueSpeedCloseDM({
      leadEmail: signal.email,
      leadName: signal.name,
      channel: signal.channel,
      signalType: classification.signalType,
      workflowId: info.workflowId,
      runId: info.runId,
    });
    speedCloses.push(sc);
  }

  // --- Step 5: Persist scan results ---
  const summary = await signalActivities.persistScanSummary({
    scanResult,
    classified,
    breakpoints,
    speedCloses,
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
  });

  return {
    status: 'completed',
    mode: 'scan',
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    signalsScanned: scanResult.signals.length,
    hotSignals: hotSignals.length,
    speedCloseTriggered: speedCloses.length,
    breakpointsTriggered: breakpoints.length,
    summary,
  };
}

exports.signalDetectionWorkflow = signalDetectionWorkflow;
