'use strict';

const { proxyActivities } = require('@temporalio/workflow');
const retryPolicy = require('./retry-policy');

const { runScoreDecay } = proxyActivities({
  taskQueue: 'ghost-engine-campaigns',
  startToCloseTimeout: '5 minutes',
  retry: retryPolicy,
});

/**
 * Score Decay Workflow
 * Runs daily at midnight UTC via cron schedule.
 * Deterministic workflowId: score-decay-YYYY-MM-DD
 */
async function scoreDecayWorkflow() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[score-decay] Starting score decay for ${today}`);
  await runScoreDecay({ date: today });
  console.log(`[score-decay] Completed score decay for ${today}`);
}

module.exports = { scoreDecayWorkflow };
