const { getTemporalConfig } = require('./config');
const { createObservability } = require('./observability');

/**
 * Linear API integration activities for the outbound chain.
 *
 * These activities close the loop: once Temporal finishes the outbound
 * sequence, they update the Linear issue to "Done" and post an execution
 * log as a comment.
 *
 * Requires LINEAR_API_KEY env var.
 */

const LINEAR_API_URL = 'https://api.linear.app/graphql';

// GHO team workflow state IDs (from linear_list_states)
const LINEAR_STATES = {
  backlog: 'f1bc9920-95a9-4f59-b7be-a63faaee160e',
  todo: '4f5410a5-9975-45a8-b183-6dd09e11e3fa',
  inProgress: '858a2b95-26f8-476d-ade5-0fb5f7e09452',
  done: '0055ebbb-56b3-4457-b645-050b4ea48823',
  canceled: '64b310f8-497a-4cdc-8681-28252e3b5de3',
  inReview: '39f1c14d-26b1-4c84-91bf-45f5ce02de8a',
};

async function linearGraphQL(query, variables = {}) {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error('LINEAR_API_KEY is not set - cannot update Linear issues');
  }

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Linear API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`);
  }

  return json.data;
}

function createLinearActivities(options = {}) {
  const config = getTemporalConfig(options.config || {});
  const observability = options.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });

  // ---------------------------------------------------------------
  // Activity: postLinearComment
  // ---------------------------------------------------------------
  async function postLinearComment(input = {}) {
    const { issueId, body } = input;

    if (!issueId || !body) {
      throw new Error('postLinearComment requires issueId and body');
    }

    observability.logger.info('linear.comment.post', {
      issueId,
      bodyLength: body.length,
    });

    const mutation = `
      mutation CreateComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment {
            id
            createdAt
          }
        }
      }
    `;

    const data = await linearGraphQL(mutation, { issueId, body });

    observability.metrics.increment('linear.comment.created', 1, { issueId });

    return {
      success: data.commentCreate.success,
      commentId: data.commentCreate.comment?.id,
      createdAt: data.commentCreate.comment?.createdAt,
    };
  }

  // ---------------------------------------------------------------
  // Activity: updateLinearIssueState
  // ---------------------------------------------------------------
  async function updateLinearIssueState(input = {}) {
    const { issueId, stateId } = input;

    if (!issueId || !stateId) {
      throw new Error('updateLinearIssueState requires issueId and stateId');
    }

    observability.logger.info('linear.issue.updateState', {
      issueId,
      stateId,
    });

    const mutation = `
      mutation UpdateIssue($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) {
          success
          issue {
            id
            identifier
            state {
              id
              name
            }
          }
        }
      }
    `;

    const data = await linearGraphQL(mutation, { issueId, stateId });

    observability.metrics.increment('linear.issue.stateUpdated', 1, {
      issueId,
      stateId,
    });

    return {
      success: data.issueUpdate.success,
      issueId: data.issueUpdate.issue?.id,
      identifier: data.issueUpdate.issue?.identifier,
      newState: data.issueUpdate.issue?.state?.name,
    };
  }

  // ---------------------------------------------------------------
  // Activity: completeLinearIssue
  //
  // The main closer. Moves issue to Done + posts the execution log.
  // ---------------------------------------------------------------
  async function completeLinearIssue(input = {}) {
    const {
      issueId,
      issueIdentifier,
      issueUrl,
      outcome,
      sequenceResult,
      leadContext,
      workflowId,
      runId,
      startedAt,
    } = input;

    observability.logger.info('linear.issue.complete', {
      issueId,
      issueIdentifier,
      outcome: outcome?.type,
    });

    // Step 1: Move to Done
    const stateUpdate = await updateLinearIssueState({
      issueId,
      stateId: LINEAR_STATES.done,
    });

    // Step 2: Build the execution log comment
    const completedAt = new Date().toISOString();
    const durationMs = startedAt ? Date.now() - Date.parse(startedAt) : 0;
    const durationSec = Math.round(durationMs / 1000);

    const sequenceSummary = sequenceResult
      ? [
          `**Sequence:** ${sequenceResult.sequenceName || sequenceResult.sequenceId}`,
          `**Steps executed:** ${sequenceResult.stepsImmediate || 0} immediate, ${sequenceResult.stepsScheduled || 0} scheduled`,
          `**Lead tier:** ${leadContext?.tier || 'unknown'}`,
          `**Lead email:** ${leadContext?.leadEmail || 'n/a'}`,
        ].join('\n')
      : 'No sequence executed.';

    const commentBody = [
      '## Temporal Outbound Chain - Execution Log',
      '',
      `**Status:** ${outcome?.type || 'completed'}`,
      `**Workflow ID:** \`${workflowId}\``,
      `**Run ID:** \`${runId}\``,
      `**Duration:** ${durationSec}s`,
      `**Started:** ${startedAt}`,
      `**Completed:** ${completedAt}`,
      '',
      '### Sequence Details',
      sequenceSummary,
      '',
      '### Outcome',
      `Type: ${outcome?.type || 'unknown'}`,
      outcome?.stepsExecuted ? `Steps: ${outcome.stepsExecuted}` : '',
      '',
      `---`,
      `*Powered by Ghost Engine Temporal worker on \`${config.taskQueue}\`*`,
    ].filter(Boolean).join('\n');

    const comment = await postLinearComment({
      issueId,
      body: commentBody,
    });

    observability.metrics.increment('linear.issue.completed', 1, {
      issueId,
      identifier: issueIdentifier,
    });

    return {
      stateUpdate,
      comment,
      issueId,
      issueIdentifier,
      completedAt,
      durationSec,
    };
  }

  return {
    postLinearComment,
    updateLinearIssueState,
    completeLinearIssue,
  };
}

module.exports = {
  createLinearActivities,
  LINEAR_STATES,
};
