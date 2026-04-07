const { campaignWorkflow } = require('./campaign-workflow');
const {
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
} = require('./heartbeat-workflows');
const { outboundChainWorkflow } = require('./outbound-chain-workflow');

module.exports = {
  campaignWorkflow,
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
  outboundChainWorkflow,
};
