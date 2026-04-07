const { campaignWorkflow } = require('./campaign-workflow');
const {
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
} = require('./heartbeat-workflows');
const { outboundChainWorkflow } = require('./outbound-chain-workflow');
const { pipelineLifecycleWorkflow } = require('./pipeline-lifecycle-workflow');
const { proofLoopWorkflow } = require('./proof-loop-workflow');
const { signalDetectionWorkflow } = require('./signal-detection-workflow');

module.exports = {
  campaignWorkflow,
  heartbeatMorningWorkflow,
  heartbeatCloserWorkflow,
  heartbeatFulfillmentWorkflow,
  heartbeatNightlyWorkflow,
  heartbeatDataSyncWorkflow,
  outboundChainWorkflow,
  pipelineLifecycleWorkflow,
  proofLoopWorkflow,
  signalDetectionWorkflow,
};
