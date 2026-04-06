const { getTemporalConfig } = require('./config');
const { createStateStore } = require('./state-store');
const { createDedupeHelper } = require('./dedupe');
const { createObservability } = require('./observability');

function createCampaignActivities(options = {}) {
  const config = getTemporalConfig(options.config || {});
  const observability = options.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });
  const store = options.stateStore || createStateStore({
    filePath: config.statePath,
    namespace: config.namespace,
    logger: observability.logger,
  });
  const dedupe = options.dedupe || createDedupeHelper(store, {
    namespace: config.namespace,
  });

  async function loadCampaignState(input = {}) {
    const campaignId = input.campaignId || input.stateKey;
    const key = input.stateKey || `campaign:${campaignId}`;
    const existing = await store.get(key);

    if (existing) {
      observability.metrics.increment('campaign.state.loaded', 1, { campaignId });
      return existing;
    }

    const initial = {
      campaignId,
      key,
      status: 'initialized',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: [],
      ...input.initialState,
    };

    await store.set(key, initial);
    observability.metrics.increment('campaign.state.initialized', 1, { campaignId });
    return initial;
  }

  async function upsertCampaignState(input = {}) {
    const campaignId = input.campaignId || input.stateKey;
    const key = input.stateKey || `campaign:${campaignId}`;
    const current = (await store.get(key)) || {};
    const next = {
      ...current,
      ...input.patch,
      campaignId,
      key,
      updatedAt: new Date().toISOString(),
    };

    await store.set(key, next);
    observability.metrics.increment('campaign.state.saved', 1, { campaignId });
    return next;
  }

  async function recordCampaignEvent(input = {}) {
    const event = {
      id: input.id || `evt_${Date.now().toString(36)}`,
      campaignId: input.campaignId || null,
      type: input.type || 'campaign.event',
      at: new Date().toISOString(),
      payload: input.payload || input,
    };

    observability.logger.info(event.type, event);
    observability.metrics.increment(`campaign.event.${event.type}`, 1, {
      campaignId: event.campaignId || 'unknown',
    });
    return event;
  }

  async function claimCampaignExecution(input = {}) {
    const scope = input.scope || 'campaign-workflow';
    const payload = {
      campaignId: input.campaignId,
      idempotencyKey: input.idempotencyKey || input.campaignId || input.stateKey,
      stateKey: input.stateKey || null,
      payload: input.payload || input,
    };
    const claim = await dedupe.claim(scope, payload, {
      campaignId: input.campaignId,
      taskQueue: config.taskQueue,
    });

    observability.metrics.increment(claim.deduped ? 'campaign.execution.deduped' : 'campaign.execution.claimed', 1, {
      campaignId: input.campaignId || 'unknown',
    });

    return claim;
  }

  async function releaseCampaignExecution(input = {}) {
    if (!input.key) {
      throw new Error('releaseCampaignExecution requires key');
    }

    if (input.status === 'failed') {
      await dedupe.fail(input.key, input.error || input.reason || { message: 'unknown failure' });
      observability.metrics.increment('campaign.execution.failed', 1, {
        campaignId: input.campaignId || 'unknown',
      });
      return { released: true, status: 'failed' };
    }

    const result = await dedupe.complete(input.key, input.output || input.result || {});
    observability.metrics.increment('campaign.execution.completed', 1, {
      campaignId: input.campaignId || 'unknown',
    });
    return result;
  }

  async function traceCampaignStep(input = {}, fn = async () => null) {
    return observability.tracer.withSpan(
      input.step || 'campaign.step',
      {
        campaignId: input.campaignId,
        taskQueue: config.taskQueue,
      },
      fn,
    );
  }

  async function snapshotCampaignSystem(input = {}) {
    const prefix = input.prefix || 'campaign:';
    const entries = await store.list(prefix);
    return {
      campaignId: input.campaignId || null,
      prefix,
      entries,
      metrics: observability.metrics.snapshot(),
    };
  }

  return {
    loadCampaignState,
    upsertCampaignState,
    recordCampaignEvent,
    claimCampaignExecution,
    releaseCampaignExecution,
    traceCampaignStep,
    snapshotCampaignSystem,
  };
}

module.exports = {
  createCampaignActivities,
};
