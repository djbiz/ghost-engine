const { proxyActivities, workflowInfo, condition, sleep } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const outboundActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '15 minutes', heartbeatTimeout: '30 seconds' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 5 }),
});

const linearActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '5 minutes' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

/**
 * outboundChainWorkflow
 *
 * The core Linear -> Temporal -> Linear loop.
 *
 * Trigger: Linear webhook fires on GHO issue status change.
 * Flow:
 *   1. Validate the status transition is actionable
 *   2. Dedupe on issueId + transition so duplicate webhooks are harmless
 *   3. Resolve lead context from Airtable/CRM
 *   4. Execute the tier-appropriate outreach sequence
 *   5. Wait for outcome signal (reply, timeout, or manual override)
 *   6. Update the Linear issue to "Done" and post execution log as comment
 *
 * Input shape:
 *   {
 *     issueId:       string   - Linear issue ID
 *     issueIdentifier: string - e.g. "GHO-36"
 *     issueTitle:    string
 *     issueUrl:      string
 *     previousStatus: string  - status the issue moved FROM
 *     newStatus:     string   - status the issue moved TO
 *     projectId:     string   - Linear project ID (optional, for filtering)
 *     projectName:   string   - e.g. "Outreach"
 *     leadEmail:     string   - extracted from issue title/description (optional)
 *     leadName:      string   - extracted from issue title/description (optional)
 *     metadata:      object   - any extra context from the webhook
 *   }
 */
async function outboundChainWorkflow(input = {}) {
  const info = workflowInfo();
  const startedAt = new Date().toISOString();

  // --- Step 1: Validate ---
  const validation = await outboundActivities.validateStatusTransition({
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    projectName: input.projectName,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  if (!validation.actionable) {
    await linearActivities.postLinearComment({
      issueId: input.issueId,
      body: `[Temporal] Skipped outbound chain - transition "${input.previousStatus}" -> "${input.newStatus}" is not actionable. Reason: ${validation.reason}`,
    });

    return {
      status: 'skipped',
      reason: validation.reason,
      issueId: input.issueId,
      workflowId: info.workflowId,
      runId: info.runId,
    };
  }

  // --- Step 2: Dedupe ---
  const dedupeResult = await outboundActivities.dedupeOutboundExecution({
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    transition: `${input.previousStatus}->${input.newStatus}`,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  if (dedupeResult.deduped) {
    return {
      status: 'deduped',
      issueId: input.issueId,
      key: dedupeResult.key,
      workflowId: info.workflowId,
      runId: info.runId,
    };
  }

  // --- Step 3: Resolve lead context ---
  const leadContext = await outboundActivities.resolveLeadContext({
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    issueTitle: input.issueTitle,
    leadEmail: input.leadEmail,
    leadName: input.leadName,
    newStatus: input.newStatus,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 4: Execute outreach sequence ---
  const sequenceResult = await outboundActivities.executeOutreachSequence({
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    leadContext,
    newStatus: input.newStatus,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 5: Await outcome ---
  // Use a durable timer. The workflow will sleep for the configured window
  // (default 48h). External signals can wake it early via Temporal signal.
  let outcome = { type: 'timeout', resolvedAt: null };
  const outcomeTimeoutMs = leadContext.outcomeTimeoutMs || 48 * 60 * 60 * 1000;

  const signalReceived = { value: false, data: null };

  // Register handler for external outcome signal
  // (e.g. lead replied, call booked, manual override from Derek)
  const handleOutcomeSignal = (signalData) => {
    signalReceived.value = true;
    signalReceived.data = signalData;
  };

  // Temporal workflow.defineSignal is not available via require in sandboxed
  // workflows, so we use condition() to wait for the signal flag or timeout.
  // The webhook listener can send a signal to this workflow when a reply is detected.

  // For now, we proceed after executing the sequence. The outcome wait
  // becomes a child workflow or a timer + signal pattern in Phase 5.
  // Phase 4 ships the chain end-to-end without blocking on reply detection.

  outcome = {
    type: sequenceResult.sequenceCompleted ? 'sequence_completed' : 'sequence_partial',
    stepsExecuted: sequenceResult.stepsExecuted,
    resolvedAt: new Date().toISOString(),
  };

  // --- Step 6: Update Linear issue ---
  const linearUpdate = await linearActivities.completeLinearIssue({
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    issueUrl: input.issueUrl,
    outcome,
    sequenceResult,
    leadContext,
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
  });

  // --- Step 7: Release dedupe claim ---
  await outboundActivities.releaseOutboundExecution({
    key: dedupeResult.key,
    issueId: input.issueId,
    status: 'completed',
    output: {
      outcome,
      linearUpdate,
    },
  });

  return {
    status: 'completed',
    issueId: input.issueId,
    issueIdentifier: input.issueIdentifier,
    outcome,
    sequenceResult,
    linearUpdate,
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
    completedAt: new Date().toISOString(),
  };
}

exports.outboundChainWorkflow = outboundChainWorkflow;
