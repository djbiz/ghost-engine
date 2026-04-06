const { proxyActivities, workflowInfo } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const campaignActivities = proxyActivities({
  ...getCampaignActivityTimeouts(),
  retry: getCampaignActivityRetryPolicy(),
});

async function campaignWorkflow(input = {}) {
  const info = workflowInfo();
  const normalized = {
    campaignId: input.campaignId || info.workflowId,
    stateKey: input.stateKey || `campaign:${input.campaignId || info.workflowId}`,
    idempotencyKey: input.idempotencyKey || input.campaignId || info.workflowId,
    metadata: input.metadata || {},
    payload: input.payload || input,
  };

  await campaignActivities.recordCampaignEvent({
    campaignId: normalized.campaignId,
    type: 'workflow.started',
    payload: {
      workflowId: info.workflowId,
      runId: info.runId,
      taskQueue: info.taskQueue,
      ...normalized.metadata,
    },
  });

  const claim = await campaignActivities.claimCampaignExecution({
    campaignId: normalized.campaignId,
    stateKey: normalized.stateKey,
    idempotencyKey: normalized.idempotencyKey,
    payload: normalized.payload,
    scope: 'campaign-workflow',
  });

  if (claim.deduped) {
    await campaignActivities.recordCampaignEvent({
      campaignId: normalized.campaignId,
      type: 'workflow.deduped',
      payload: {
        dedupeKey: claim.key,
      },
    });

    return {
      status: 'deduped',
      campaignId: normalized.campaignId,
      key: claim.key,
      state: claim.record,
    };
  }

  try {
    const state = await campaignActivities.loadCampaignState({
      campaignId: normalized.campaignId,
      stateKey: normalized.stateKey,
      initialState: {
        campaignId: normalized.campaignId,
        stateKey: normalized.stateKey,
        status: 'initialized',
        workflowId: info.workflowId,
        runId: info.runId,
        metadata: normalized.metadata,
      },
    });

    const nextState = await campaignActivities.upsertCampaignState({
      campaignId: normalized.campaignId,
      stateKey: normalized.stateKey,
      patch: {
        status: 'ready_for_logic',
        lastWorkflowId: info.workflowId,
        lastRunId: info.runId,
        lastPayload: normalized.payload,
      },
    });

    await campaignActivities.recordCampaignEvent({
      campaignId: normalized.campaignId,
      type: 'workflow.ready',
      payload: {
        stateKey: normalized.stateKey,
      },
    });

    await campaignActivities.releaseCampaignExecution({
      key: claim.key,
      campaignId: normalized.campaignId,
      status: 'completed',
      output: nextState,
    });

    return {
      status: 'ready_for_logic',
      campaignId: normalized.campaignId,
      state,
      nextState,
      key: claim.key,
    };
  } catch (error) {
    await campaignActivities.recordCampaignEvent({
      campaignId: normalized.campaignId,
      type: 'workflow.failed',
      payload: {
        message: error?.message,
        name: error?.name,
      },
    });

    await campaignActivities.releaseCampaignExecution({
      key: claim.key,
      campaignId: normalized.campaignId,
      status: 'failed',
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
    });

    throw error;
  }
}

exports.campaignWorkflow = campaignWorkflow;
