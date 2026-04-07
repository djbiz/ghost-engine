// temporal/proof-loop-workflow.js
// Proof loop workflow — generates proof assets from closed-won deals
// Deterministic workflowId: proof-loop-YYYY-MM-DD
'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const { runProofLoop } = proxyActivities({
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
 * Proof loop workflow.
 * Detects new closed-won deals from CRM and generates proof assets
 * (case study outlines, social posts, win announcements)
 * written to data/proof-assets/ directory.
 *
 * @param {object} input
 * @param {string} input.date - ISO date string YYYY-MM-DD
 */
async function proofLoopWorkflow(input) {
  const date = input && input.date
    ? input.date
    : new Date().toISOString().slice(0, 10);

  const result = await runProofLoop({ date });

  return { status: 'completed', date, dealsProcessed: result.dealsProcessed };
}

module.exports = { proofLoopWorkflow };
