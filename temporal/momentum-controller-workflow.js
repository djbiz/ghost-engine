'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const retryPolicy = {
  maximumAttempts: 5,
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1 minute',
};

const { runMomentumAdjust } = proxyActivities({
  startToCloseTimeout: '5 minutes',
  taskQueue: 'ghost-engine-campaigns',
  retry: retryPolicy,
});

/**
 * Momentum Controller Auto-Adjust Workflow
 * Deterministic workflowId: momentum-adjust-YYYY-MM-DD
 * Task queue: ghost-engine-campaigns
 */
async function momentumControllerWorkflow(input) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const result = await runMomentumAdjust({
    date,
    metrics: input.metrics || {},
    config: input.config || {},
  });
  return result;
}

module.exports = { momentumControllerWorkflow };
