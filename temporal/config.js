const DEFAULTS = {
  address: process.env.TEMPORAL_ADDRESS || 'quickstart-derekjami-878d5147.kydxq',
  namespace: process.env.TEMPORAL_NAMESPACE || 'quickstart-derekjami-878d5147.kydxq',
  profile: process.env.TEMPORAL_PROFILE || 'cloud',
  taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'ghost-engine-campaigns',
  workflowTimeout: process.env.TEMPORAL_WORKFLOW_TIMEOUT || '30 minutes',
  activityTimeout: process.env.TEMPORAL_ACTIVITY_TIMEOUT || '10 minutes',
  statePath: process.env.TEMPORAL_STATE_PATH || './data/temporal-state.json',
  apiKey: process.env.TEMPORAL_API_KEY || '',
  tls: process.env.TEMPORAL_TLS !== 'false',
  serviceName: 'ghost-engine-temporal',
};

function getTemporalConfig(overrides = {}) {
  return {
    ...DEFAULTS,
    ...overrides,
  };
}

function getTemporalNamespace() {
  return process.env.TEMPORAL_NAMESPACE || DEFAULTS.namespace;
}

function getTemporalTaskQueue() {
  return process.env.TEMPORAL_TASK_QUEUE || DEFAULTS.taskQueue;
}

function getTemporalConnectionOptions(overrides = {}) {
  const config = getTemporalConfig(overrides);
  const options = {
    address: config.address,
  };

  if (config.tls) {
    options.tls = {};
  }

  if (config.apiKey) {
    options.apiKey = config.apiKey;
  }

  return options;
}

module.exports = {
  DEFAULTS,
  getTemporalConfig,
  getTemporalNamespace,
  getTemporalTaskQueue,
  getTemporalConnectionOptions,
};
