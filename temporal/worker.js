const { NativeConnection, Worker } = require('@temporalio/worker');
const { getTemporalConfig, getTemporalConnectionOptions } = require('./config');
const { createCampaignActivities } = require('./activities');
const { createHeartbeatActivities } = require('./heartbeat-activities');
const { createOutboundChainActivities } = require('./outbound-chain-activities');
const { createLinearActivities } = require('./linear-activities');
const { createObservability } = require('./observability');
// Phase 4 fix: 8 existing activity factories (restored by zo)
const { createScoreDecayActivities } = require('./score-decay-activities');
const { createSundayEvolutionActivities } = require('./sunday-evolution-activities');
const { createNightlyConsolidationActivities } = require('./nightly-consolidation-activities');
const { createProofLoopActivities } = require('./proof-loop-activities');
const { createPipelineAutomationActivities } = require('./pipeline-automation-activities');
const { createContentEngineActivities } = require('./content-engine-activities');
const { createLinkedinEngagementActivities } = require('./linkedin-engagement-activities');
const { createMomentumControllerActivities } = require('./momentum-controller-activities');
// Phase 5: pipeline lifecycle, proof loop (temporal-native), signal detection
const { createPipelineLifecycleActivities } = require('./pipeline-lifecycle-activities');
const { createProofLoopTemporalActivities } = require('./proof-loop-temporal-activities');
const { createSignalDetectionActivities } = require('./signal-detection-activities');

async function createCampaignWorker(overrides = {}) {
  const config = getTemporalConfig(overrides.config || {});
  const observability = overrides.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });
  const connection = overrides.connection || await NativeConnection.connect(
    overrides.connectionOptions || getTemporalConnectionOptions(config),
  );

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities: overrides.activities || {
      ...createCampaignActivities({
        config,
        observability,
      }),
      ...createHeartbeatActivities({
        config,
        observability,
      }),
      ...createOutboundChainActivities({
        config,
        observability,
      }),
      ...createLinearActivities({
        config,
        observability,
      }),
      // Phase 4 fix: 8 existing activity factories (restored by zo)
      ...createScoreDecayActivities({
        config,
        observability,
      }),
      ...createSundayEvolutionActivities({
        config,
        observability,
      }),
      ...createNightlyConsolidationActivities({
        config,
        observability,
      }),
      ...createProofLoopActivities({
        config,
        observability,
      }),
      ...createPipelineAutomationActivities({
        config,
        observability,
      }),
      ...createContentEngineActivities({
        config,
        observability,
      }),
      ...createLinkedinEngagementActivities({
        config,
        observability,
      }),
      ...createMomentumControllerActivities({
        config,
        observability,
      }),
      // Phase 5: pipeline lifecycle, proof loop (temporal-native), signal detection
      ...createPipelineLifecycleActivities({
        config,
        observability,
      }),
      ...createProofLoopTemporalActivities({
        config,
        observability,
      }),
      ...createSignalDetectionActivities({
        config,
        observability,
      }),
    },
    logger: observability.logger,
  });

  return { worker, connection, config, observability };
}

async function runCampaignWorker(overrides = {}) {
  const { worker, connection, config, observability } = await createCampaignWorker(overrides);
  observability.logger.info('temporal.worker.starting', {
    address: config.address,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
    profile: config.profile,
  });

  try {
    await worker.run();
  } finally {
    await connection?.close?.();
  }
}

module.exports = {
  createCampaignWorker,
  runCampaignWorker,
};
