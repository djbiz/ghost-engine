#!/usr/bin/env node
const temporalClient = require('@temporalio/client');
const { getTemporalConfig } = require('../temporal/config');
const { createObservability } = require('../temporal/observability');

async function ensureNamespace(connection, namespace, logger) {
  const service = connection.workflowService || connection.service;
  if (!service || typeof service.describeNamespace !== 'function') {
    logger.warn('temporal.namespace.skip', {
      reason: 'namespace-management-api-unavailable',
      namespace,
    });
    return { created: false, skipped: true };
  }

  try {
    await service.describeNamespace({ namespace });
    logger.info('temporal.namespace.exists', { namespace });
    return { created: false, exists: true };
  } catch (error) {
    if (typeof service.registerNamespace === 'function') {
      await service.registerNamespace({
        namespace,
        description: 'Ghost Engine campaign orchestration namespace',
        workflowExecutionRetentionPeriod: '7 days',
      });
      logger.info('temporal.namespace.created', { namespace });
      return { created: true };
    }
    throw error;
  }
}

async function main() {
  const config = getTemporalConfig();
  const observability = createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });

  observability.logger.info('temporal.bootstrap.start', {
    address: config.address,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });

  const Connection = temporalClient.Connection || temporalClient.NativeConnection;
  if (!Connection || typeof Connection.connect !== 'function') {
    throw new Error('Temporal client connection factory is unavailable in the installed SDK');
  }

  const connection = await Connection.connect({ address: config.address });

  await ensureNamespace(connection, config.namespace, observability.logger);

  observability.logger.info('temporal.bootstrap.ready', {
    address: config.address,
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });

  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
