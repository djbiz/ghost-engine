const { proxyActivities, workflowInfo } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const heartbeatActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '15 minutes', heartbeatTimeout: '30 seconds' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

async function runHeartbeatWorkflow(beat, input = {}) {
  const info = workflowInfo();
  const normalized = {
    beat,
    date: input.date || null,
    workflowId: info.workflowId,
    runId: info.runId,
    payload: input.payload || input,
  };

  const summary = await heartbeatActivities.captureOperationalSnapshot({
    ...normalized,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const dailyNote = await heartbeatActivities.ensureDailyNote({
    beat,
    date: summary.date,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const enrichedNote = await heartbeatActivities.enrichDailyNote({
    beat,
    summary,
    dailyNote,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const metrics = await heartbeatActivities.syncMetricsSnapshot({
    beat,
    summary,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const state = await heartbeatActivities.syncHeartbeatState({
    beat,
    summary,
    dailyNote: enrichedNote,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  const entry = await heartbeatActivities.appendHeartbeatLog({
    beat,
    summary,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  return {
    beat,
    workflowId: info.workflowId,
    runId: info.runId,
    summary,
    metrics,
    state,
    dailyNote: enrichedNote,
    logEntry: entry,
  };
}

async function heartbeatMorningWorkflow(input = {}) {
  return await runHeartbeatWorkflow('morning', input);
}

async function heartbeatCloserWorkflow(input = {}) {
  return await runHeartbeatWorkflow('closer', input);
}

async function heartbeatFulfillmentWorkflow(input = {}) {
  return await runHeartbeatWorkflow('fulfillment', input);
}

async function heartbeatNightlyWorkflow(input = {}) {
  return await runHeartbeatWorkflow('nightly', input);
}

async function heartbeatDataSyncWorkflow(input = {}) {
  const enrichedInput = {
    ...input,
    payload: {
      ...(input.payload || input),
      mode: 'data-sync',
    },
  };

  return await runHeartbeatWorkflow('sync', enrichedInput);
}

module.exports = {
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
};
