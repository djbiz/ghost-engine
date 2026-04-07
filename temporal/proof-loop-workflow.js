const { proxyActivities, workflowInfo, sleep } = require('@temporalio/workflow');
const { getCampaignActivityRetryPolicy, getCampaignActivityTimeouts } = require('./retry-policy');

const proofActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '15 minutes', heartbeatTimeout: '30 seconds' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

const linearActivities = proxyActivities({
  ...getCampaignActivityTimeouts({ startToCloseTimeout: '5 minutes' }),
  retry: getCampaignActivityRetryPolicy({ maximumAttempts: 3 }),
});

/**
 * proofLoopWorkflow
 *
 * Replaces scripts/proof-loop.js and scripts/automation-proof-loop.js.
 *
 * Trigger: Deal closes (Linear status -> "Done"/"Won", or Stripe payment confirmed).
 * The outboundChainWorkflow can spawn this as a child, or the webhook listener
 * can start it directly on a "Closed Won" transition.
 *
 * Flow:
 *   1. Validate the close event and resolve client data
 *   2. Generate case study document (within 48h deadline - GHO-25 spec)
 *   3. Generate 3 authority posts for LinkedIn
 *   4. Generate breakdown content for carousel
 *   5. Queue posts to Blotato for publishing
 *   6. Update Linear: create Content project issue, post log to original deal issue
 *   7. Update MEMORY.md and lessons-learned.md
 *   8. Persist proof assets and log to close-log.jsonl
 *
 * Input shape:
 *   {
 *     clientName:    string
 *     clientEmail:   string
 *     platform:      string  - e.g. "TikTok", "LinkedIn"
 *     followers:     string  - e.g. "45K"
 *     tier:          string  - "Quick Flip", "Full Engine", "Ghost Partner"
 *     investment:    string  - e.g. "$990", "$4,970"
 *     timeline:      string  - e.g. "48 hours", "14 days"
 *     result:        string  - e.g. "$3K/month revenue"
 *     quote:         string  - client testimonial
 *     details:       string  - what was built
 *     issueId:       string  - Linear issue ID (optional, for commenting back)
 *     issueIdentifier: string - e.g. "GHO-36"
 *     metadata:      object
 *   }
 */
async function proofLoopWorkflow(input = {}) {
  const info = workflowInfo();
  const startedAt = new Date().toISOString();

  // --- Step 1: Validate and resolve client data ---
  const clientContext = await proofActivities.resolveClientContext({
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    platform: input.platform,
    followers: input.followers,
    tier: input.tier,
    investment: input.investment,
    timeline: input.timeline,
    result: input.result,
    quote: input.quote,
    details: input.details,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 2: Generate case study ---
  const caseStudy = await proofActivities.generateCaseStudy({
    client: clientContext,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 3: Generate authority posts ---
  const authorityPosts = await proofActivities.generateAuthorityPosts({
    client: clientContext,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 4: Generate breakdown ---
  const breakdown = await proofActivities.generateBreakdown({
    client: clientContext,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 5: Queue to Blotato ---
  const publishing = await proofActivities.queueProofContent({
    caseStudy,
    authorityPosts,
    breakdown,
    client: clientContext,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 6: Update Linear ---
  let linearResult = null;
  if (input.issueId) {
    linearResult = await linearActivities.postLinearComment({
      issueId: input.issueId,
      body: [
        '## Proof Loop - Execution Complete',
        '',
        `**Client:** ${clientContext.name}`,
        `**Platform:** ${clientContext.platform}`,
        `**Tier:** ${clientContext.tier}`,
        `**Result:** ${clientContext.result}`,
        '',
        '### Assets Generated',
        `- Case study: ${caseStudy.filePath}`,
        `- Authority posts: ${authorityPosts.count} posts`,
        `- Breakdown: ${breakdown.filePath}`,
        '',
        `**Blotato queue:** ${publishing.queued ? 'Queued for publishing' : 'Manual publish required'}`,
        '',
        `---`,
        `*Temporal workflow \`${info.workflowId}\`*`,
      ].join('\n'),
    });
  }

  // --- Step 7: Update memory and lessons ---
  const memoryUpdate = await proofActivities.updateMemoryAndLessons({
    client: clientContext,
    caseStudy,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  // --- Step 8: Persist to close log ---
  const logEntry = await proofActivities.appendCloseLog({
    client: clientContext,
    caseStudy,
    authorityPosts,
    breakdown,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  return {
    status: 'completed',
    workflowId: info.workflowId,
    runId: info.runId,
    startedAt,
    completedAt: new Date().toISOString(),
    client: {
      name: clientContext.name,
      platform: clientContext.platform,
      tier: clientContext.tier,
    },
    assets: {
      caseStudy: caseStudy.filePath,
      authorityPosts: authorityPosts.count,
      breakdown: breakdown.filePath,
    },
    publishing,
    linearResult,
    memoryUpdate,
    logEntry,
  };
}

exports.proofLoopWorkflow = proofLoopWorkflow;
