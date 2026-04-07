'use strict';

const { Worker } = require('@temporalio/worker');
const { createScoreDecayActivities } = require('./score-decay-activities');
const { createSundayEvolutionActivities } = require('./sunday-evolution-activities');

const TASK_QUEUE = 'ghost-engine-campaigns';

async function run() {
  const config = { basePath: process.env.GHOST_ENGINE_BASE || process.cwd() };

  const scoreDecay = createScoreDecayActivities(config);
  const sundayEvolution = createSundayEvolutionActivities(config);

  const worker = await Worker.create({
    workflowsPath: require.resolve('./score-decay-workflow'),
    activities: { ...scoreDecay, ...sundayEvolution },
    taskQueue: TASK_QUEUE,
  });

  console.log(`[ghost-engine] Worker started on task queue: ${TASK_QUEUE}`);
  await worker.run();
}

run().catch((err) => {
  console.error('[ghost-engine] Worker failed:', err);
  process.exit(1);
});
