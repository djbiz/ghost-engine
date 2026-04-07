'use strict';

const { NativeConnection, Worker } = require('@temporalio/worker');
const { createCampaignActivities } = require('./activities');
const { createHeartbeatActivities } = require('./heartbeat-activities');
const { createScoreDecayActivities } = require('./score-decay-activities');
const { createSundayEvolutionActivities } = require('./sunday-evolution-activities');
const { createNightlyConsolidationActivities } = require('./nightly-consolidation-activities');
const { createProofLoopActivities } = require('./proof-loop-activities');
const { createPipelineAutomationActivities } = require('./pipeline-automation-activities');
const { createContentEngineActivities } = require('./content-engine-activities');
const { createLinkedinEngagementActivities } = require('./linkedin-engagement-activities');
const { createMomentumControllerActivities } = require('./momentum-controller-activities');
const { setupTracing } = require('./observability');
const config = require('./config');

async function run() {
  await setupTracing('ghost-engine-worker');

  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  const campaignActs = createCampaignActivities(config);
  const heartbeatActs = createHeartbeatActivities(config);
  const scoreDecayActs = createScoreDecayActivities(config);
  const sundayEvolutionActs = createSundayEvolutionActivities(config);
  const nightlyConsolidationActs = createNightlyConsolidationActivities(config);
  const proofLoopActs = createProofLoopActivities(config);
  const pipelineAutomationActs = createPipelineAutomationActivities(config);
  const contentEngineActs = createContentEngineActivities(config);
  const linkedinEngagementActs = createLinkedinEngagementActivities(config);
  const momentumControllerActs = createMomentumControllerActivities(config);

  const worker = await Worker.create({
    connection,
    namespace: config.temporalNamespace,
    taskQueue: 'ghost-engine-campaigns',
    workflowsPath: require.resolve('./workflows'),
    activities: {
      ...campaignActs,
      ...heartbeatActs,
      ...scoreDecayActs,
      ...sundayEvolutionActs,
      ...nightlyConsolidationActs,
      ...proofLoopActs,
      ...pipelineAutomationActs,
      ...contentEngineActs,
      ...linkedinEngagementActs,
      ...momentumControllerActs,
    },
  });

  console.log('Ghost-engine worker started on task queue: ghost-engine-campaigns');
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
