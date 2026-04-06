const { campaignWorkflow } = require('./campaign-workflow');
const {
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
} = require('./heartbeat-workflows');

module.exports = {
  campaignWorkflow,
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
};
