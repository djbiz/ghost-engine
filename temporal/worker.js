const { NativeConnection, Worker } = require('@temporalio/worker');
const { getTemporalConfig, getTemporalConnectionOptions } = require('./config');
const { createCampaignActivities } = require('./activities');
const { createHeartbeatActivities } = require('./heartbeat-activities');
const { createObservability } = require('./observability');

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
