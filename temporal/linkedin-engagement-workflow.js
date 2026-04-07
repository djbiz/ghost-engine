'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const retryPolicy = {
  maximumAttempts: 5,
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1 minute',
};

const { runLinkedinEngagement } = proxyActivities({
  startToCloseTimeout: '5 minutes',
  taskQueue: 'ghost-engine-campaigns',
  retry: retryPolicy,
});

/**
 * LinkedIn Engagement Tracking Workflow
 * Deterministic workflowId: linkedin-engagement-YYYY-MM-DD
 * Task queue: ghost-engine-campaigns
 */
async function linkedinEngagementWorkflow(input) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const result = await runLinkedinEngagement({
    date,
    sandbox: input.sandbox || false,
    config: input.config || {},
  });
  return result;
}

module.exports = { linkedinEngagementWorkflow };
