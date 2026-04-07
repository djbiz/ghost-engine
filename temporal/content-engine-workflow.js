'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const { runContentEngine } = proxyActivities({
  taskQueue: 'ghost-engine-campaigns',
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 5,
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1 minute',
  },
});

/**
 * Content Engine Workflow
 * Daily content brief generation using pipeline/outreach signals.
 * Deterministic workflowId: content-engine-YYYY-MM-DD
 */
async function contentEngineWorkflow(input) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const runId = `content-engine-${date}`;

  console.log(`[ContentEngine] Starting run: ${runId}`);

  const brief = await runContentEngine({
    runId,
    date,
    ...input,
  });

  console.log(`[ContentEngine] Completed run: ${runId}`);
  return brief;
}

module.exports = { contentEngineWorkflow };
