'use strict';

const { proxyActivities } = require('@temporalio/workflow');
const retryPolicy = require('./retry-policy');

const { runSundayEvolution } = proxyActivities({
  taskQueue: 'ghost-engine-campaigns',
  startToCloseTimeout: '10 minutes',
  retry: retryPolicy,
});

/**
 * Sunday Evolution Workflow
 * Runs every Sunday at 8 PM UTC via cron schedule.
 * Deterministic workflowId: sunday-evolution-YYYY-MM-DD
 */
async function sundayEvolutionWorkflow() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[sunday-evolution] Starting evolution analysis for ${today}`);
  await runSundayEvolution({ date: today });
  console.log(`[sunday-evolution] Completed evolution analysis for ${today}`);
}

module.exports = { sundayEvolutionWorkflow };
