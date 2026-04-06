const DEFAULT_CAMPAIGN_ACTIVITY_RETRY_POLICY = {
  initialInterval: '1s',
  backoffCoefficient: 2,
  maximumInterval: '1 minute',
  maximumAttempts: 5,
  nonRetryableErrorTypes: [
    'ValidationError',
    'DedupeError',
    'StateConflictError',
  ],
};

const DEFAULT_CAMPAIGN_ACTIVITY_TIMEOUTS = {
  startToCloseTimeout: '10 minutes',
  heartbeatTimeout: '30 seconds',
};

function getCampaignActivityRetryPolicy(overrides = {}) {
  return {
    ...DEFAULT_CAMPAIGN_ACTIVITY_RETRY_POLICY,
    ...overrides,
  };
}

function getCampaignActivityTimeouts(overrides = {}) {
  return {
    ...DEFAULT_CAMPAIGN_ACTIVITY_TIMEOUTS,
    ...overrides,
  };
}

module.exports = {
  DEFAULT_CAMPAIGN_ACTIVITY_RETRY_POLICY,
  DEFAULT_CAMPAIGN_ACTIVITY_TIMEOUTS,
  getCampaignActivityRetryPolicy,
  getCampaignActivityTimeouts,
};
