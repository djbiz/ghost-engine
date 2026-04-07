// temporal/nightly-consolidation-workflow.js
// Nightly consolidation workflow — runs at 11pm daily
// Deterministic workflowId: nightly-consolidation-YYYY-MM-DD
'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const { runNightlyConsolidation } = proxyActivities({
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
 * Nightly consolidation workflow.
 * Reads CRM CSV, hunt log, and inbound CSV; counts metrics
 * (leads today, conversations, closed-won); builds KPI block;
 * updates system/IDENTITY.md with KPI status table;
 * writes metrics snapshot to leads/metrics-snapshot.txt.
 *
 * @param {object} input
 * @param {string} input.date - ISO date string YYYY-MM-DD
 */
async function nightlyConsolidationWorkflow(input) {
  const date = input && input.date
    ? input.date
    : new Date().toISOString().slice(0, 10);

  await runNightlyConsolidation({ date });

  return { status: 'completed', date };
}

module.exports = { nightlyConsolidationWorkflow };
