const { proxyActivities, workflowInfo } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const pipelineActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '15 minutes', heartbeatTimeout: '30 seconds' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

/**
 * pipelineLifecycleWorkflow
 *
 * Replaces scripts/pipeline-automation.js (hourly PM2 cron).
 * Runs on a Temporal cron schedule: every hour.
 *
 * Responsibilities:
 *   1. Score inbound leads and flag unprocessed batches
 *   2. Detect stale leads (48h+ no contact) and queue re-engagement
 *   3. Escalate hot leads (score >= 85) via alert queue
 *   4. Check discovery call confirmations and follow-ups
 *   5. Trigger proof loop when close count hits threshold
 *   6. Detect speed-close signals (Stripe click, fast reply, pricing ask)
 *   7. Write pipeline health summary to state store
 *
 * Input shape (optional, injected by cron or manual trigger):
 *   {
 *     forceRun:  boolean - skip cron dedup check
 *     date:      string  - ISO date override
 *   }
 */
async function pipelineLifecycleWorkflow(input = {}) {
  const info = workflowInfo();
  const startedAt = new Date().toISOString();

  // --- Step 1: Snapshot current pipeline state ---
  const snapshot = await pipelineActivities.capturePipelineSnapshot({
    date: input.date || null,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 2: Score and flag inbound leads ---
  const scoring = await pipelineActivities.scoreInboundLeads({
    snapshot,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 3: Detect stale leads ---
  const staleResult = await pipelineActivities.detectStaleLeads({
    snapshot,
    staleThresholdHours: 48,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 4: Escalate hot leads ---
  const escalation = await pipelineActivities.escalateHotLeads({
    snapshot,
    hotThreshold: 85,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 5: Check discovery calls ---
  const callCheck = await pipelineActivities.checkDiscoveryCalls({
    snapshot,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 6: Detect speed-close signals ---
  const speedClose = await pipelineActivities.detectSpeedCloseSignals({
    snapshot,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 7: Evaluate proof loop trigger ---
  const proofCheck = await pipelineActivities.evaluateProofLoopTrigger({
    snapshot,
    closeThreshold: 3,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 8: Build actions and persist state ---
  const summary = await pipelineActivities.persistPipelineSummary({
    snapshot,
    scoring,
    staleResult,
    escalation,
    callCheck,
    speedClose,
    proofCheck,
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
  });

  return {
    status: 'completed',
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    snapshot: {
      leadCount: snapshot.leadCount,
      hotLeadCount: snapshot.hotLeadCount,
      staleLeadCount: snapshot.staleLeadCount,
      callCount: snapshot.callCount,
      closeCount: snapshot.closeCount,
    },
    actions: summary.actions,
    alerts: escalation.alerts,
    speedCloseTriggered: speedClose.triggered,
    proofLoopTriggered: proofCheck.triggered,
  };
}

exports.pipelineLifecycleWorkflow = pipelineLifecycleWorkflow;
