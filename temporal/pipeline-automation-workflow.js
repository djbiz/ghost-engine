'use strict';

const { proxyActivities } = require('@temporalio/workflow');

const { runPipelineAutomation } = proxyActivities({
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
 * Pipeline Automation Workflow
 * Hourly health check on CRM pipeline data.
 * Deterministic workflowId: pipeline-automation-YYYY-MM-DD-HH
 */
async function pipelineAutomationWorkflow(input) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const runId = `pipeline-automation-${date}-${hour}`;

  console.log(`[PipelineAutomation] Starting run: ${runId}`);

  const report = await runPipelineAutomation({
    runId,
    date,
    hour,
    ...input,
  });

  console.log(`[PipelineAutomation] Completed run: ${runId}`);
  return report;
}

module.exports = { pipelineAutomationWorkflow };
