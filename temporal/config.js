const DEFAULTS = {
  address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  namespace: process.env.TEMPORAL_NAMESPACE || 'ghost-engine',
  taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'ghost-engine-campaigns',
  workflowTimeout: process.env.TEMPORAL_WORKFLOW_TIMEOUT || '30 minutes',
  activityTimeout: process.env.TEMPORAL_ACTIVITY_TIMEOUT || '10 minutes',
  statePath: process.env.TEMPORAL_STATE_PATH || './data/temporal-state.json',
  serviceName: 'ghost-engine-temporal'
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

module.exports = {
  DEFAULTS,
  getTemporalConfig,
  getTemporalNamespace,
  getTemporalTaskQueue,
};
