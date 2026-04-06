#!/usr/bin/env node
const { runCampaignWorker } = require('../temporal/worker');

runCampaignWorker().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
