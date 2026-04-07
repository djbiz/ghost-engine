const fs = require('fs');
const path = require('path');
const { getTemporalConfig } = require('./config');
const { createStateStore } = require('./state-store');
const { createDedupeHelper } = require('./dedupe');
const { createObservability } = require('./observability');

/**
 * Status transitions that trigger the outbound chain.
 * Key = newStatus (lowercase), value = config for that transition.
 */
const ACTIONABLE_TRANSITIONS = {
  'outreach': {
    action: 'start_sequence',
    description: 'Lead moved to outreach - kick off DM/email sequence',
  },
  'outreach sent': {
    action: 'start_sequence',
    description: 'Outreach sent status - execute tier-appropriate sequence',
  },
  'won': {
    action: 'proof_loop',
    description: 'Deal closed won - trigger proof loop and delivery',
  },
  'closed won': {
    action: 'proof_loop',
    description: 'Deal closed won - trigger proof loop and delivery',
  },
  'signal detected': {
    action: 'alert_derek',
    description: 'Buying signal detected - human breakpoint alert',
  },
  'qualified': {
    action: 'start_sequence',
    description: 'Lead qualified - start closer sequence',
  },
  're-engage': {
    action: 'start_sequence',
    description: 'Stale lead flagged for re-engagement',
  },
};

/**
 * GHO project IDs that this workflow should process.
 * All others are ignored.
 */
const ALLOWED_PROJECT_NAMES = [
  'outreach',
  'sales & deals',
  'social empire - dms & optimization',
];

/**
 * Sequence definitions mapped to lead tier/segment.
 * Mirrors the config from lib/outreach-triggers.js.
 */
const SEQUENCES = {
  'tier-a-first-touch': {
    name: 'Tier A First Touch',
    steps: [
      { delay: 0, type: 'dm', channel: 'linkedin', template: 'first-touch' },
      { delay: 3, type: 'dm', channel: 'linkedin', template: 'social-proof' },
      { delay: 7, type: 'email', channel: 'email', template: 'offer-detail' },
    ],
  },
  'tier-b-nurture': {
    name: 'Tier B Nurture',
    steps: [
      { delay: 0, type: 'email', channel: 'email', template: 'intro' },
      { delay: 5, type: 'email', channel: 'email', template: 'value-tip' },
      { delay: 14, type: 'email', channel: 'email', template: 'case-study' },
    ],
  },
  're-engage': {
    name: 'Re-engage',
    steps: [
      { delay: 0, type: 'email', channel: 'email', template: 'checking-in' },
    ],
  },
  'closer': {
    name: 'Closer Sequence',
    steps: [
      { delay: 0, type: 'dm', channel: 'linkedin', template: 'first-touch' },
      { delay: 2, type: 'dm', channel: 'linkedin', template: 'social-proof' },
      { delay: 5, type: 'email', channel: 'email', template: 'offer-detail' },
      { delay: 8, type: 'dm', channel: 'linkedin', template: 'checking-in' },
    ],
  },
};

/**
 * Score thresholds for tier assignment.
 * Matches lib/outreach-triggers.js thresholds.
 */
const SCORE_THRESHOLDS = {
  hot: 85,
  warm: 70,
  cold: 50,
};

function createOutboundChainActivities(options = {}) {
  const config = getTemporalConfig(options.config || {});
  const observability = options.observability || createObservability(config.serviceName, {
    namespace: config.namespace,
    taskQueue: config.taskQueue,
  });
  const store = options.stateStore || createStateStore({
    filePath: config.statePath,
    namespace: config.namespace,
    logger: observability.logger,
  });
  const dedupe = options.dedupe || createDedupeHelper(store, {
    namespace: config.namespace,
  });

  const rootDir = options.rootDir || path.resolve(__dirname, '..');
  const leadsDir = path.join(rootDir, 'leads');
  const dataDir = path.join(rootDir, 'data');

  // ---------------------------------------------------------------
  // Activity: validateStatusTransition
  // ---------------------------------------------------------------
  async function validateStatusTransition(input = {}) {
    const newStatus = (input.newStatus || '').toLowerCase().trim();
    const projectName = (input.projectName || '').toLowerCase().trim();

    observability.logger.info('outbound.validate', {
      issueId: input.issueId,
      issueIdentifier: input.issueIdentifier,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      projectName: input.projectName,
    });

    // Check if the project is one we care about
    if (projectName && !ALLOWED_PROJECT_NAMES.some((p) => projectName.includes(p))) {
      return {
        actionable: false,
        reason: `Project "${input.projectName}" is not in the outbound chain allowlist`,
      };
    }

    const transitionConfig = ACTIONABLE_TRANSITIONS[newStatus];
    if (!transitionConfig) {
      return {
        actionable: false,
        reason: `Status "${input.newStatus}" is not an actionable outbound trigger`,
      };
    }

    observability.metrics.increment('outbound.transition.validated', 1, {
      issueId: input.issueId,
      newStatus,
      action: transitionConfig.action,
    });

    return {
      actionable: true,
      action: transitionConfig.action,
      description: transitionConfig.description,
      newStatus,
    };
  }

  // ---------------------------------------------------------------
  // Activity: dedupeOutboundExecution
  // ---------------------------------------------------------------
  async function dedupeOutboundExecution(input = {}) {
    const scope = 'outbound-chain';
    const payload = {
      issueId: input.issueId,
      transition: input.transition,
    };

    const claim = await dedupe.claim(scope, payload, {
      issueIdentifier: input.issueIdentifier,
      workflowId: input.workflowId,
      runId: input.runId,
    });

    observability.metrics.increment(
      claim.deduped ? 'outbound.execution.deduped' : 'outbound.execution.claimed',
      1,
      { issueId: input.issueId },
    );

    return claim;
  }

  // ---------------------------------------------------------------
  // Activity: releaseOutboundExecution
  // ---------------------------------------------------------------
  async function releaseOutboundExecution(input = {}) {
    if (!input.key) {
      throw new Error('releaseOutboundExecution requires key');
    }

    if (input.status === 'failed') {
      await dedupe.fail(input.key, input.error || { message: 'unknown failure' });
      observability.metrics.increment('outbound.execution.failed', 1, {
        issueId: input.issueId || 'unknown',
      });
      return { released: true, status: 'failed' };
    }

    const result = await dedupe.complete(input.key, input.output || {});
    observability.metrics.increment('outbound.execution.completed', 1, {
      issueId: input.issueId || 'unknown',
    });
    return result;
  }

  // ---------------------------------------------------------------
  // Activity: resolveLeadContext
  // ---------------------------------------------------------------
  async function resolveLeadContext(input = {}) {
    observability.logger.info('outbound.resolveLead', {
      issueId: input.issueId,
      issueIdentifier: input.issueIdentifier,
      leadEmail: input.leadEmail,
      leadName: input.leadName,
    });

    // Attempt to find lead in local CRM CSV files
    const crmPath = path.join(leadsDir, 'crm.csv');
    const inboundPath = path.join(leadsDir, 'inbound.csv');
    let lead = null;

    for (const filePath of [crmPath, inboundPath]) {
      if (!fs.existsSync(filePath)) continue;

      const raw = fs.readFileSync(filePath, 'utf8').trim();
      if (!raw) continue;

      const lines = raw.split('\n');
      const headers = lines[0].split(',').map((h) => h.trim());

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(',');
        const row = {};
        headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });

        const emailMatch = input.leadEmail && row.email && row.email.toLowerCase() === input.leadEmail.toLowerCase();
        const nameMatch = input.leadName && row.name && row.name.toLowerCase().includes(input.leadName.toLowerCase());

        if (emailMatch || nameMatch) {
          lead = row;
          break;
        }
      }

      if (lead) break;
    }

    // Determine tier from score
    const score = lead ? Number(lead.score || lead.lead_score || lead.fit_score || 0) : 0;
    let tier = 'C';
    if (score >= SCORE_THRESHOLDS.hot) tier = 'A';
    else if (score >= SCORE_THRESHOLDS.warm) tier = 'B';

    // Determine segment
    const segment = lead
      ? (lead.segment || lead.icp_segment || lead.tier || 'unknown')
      : 'unknown';

    // Pick sequence based on tier and action context
    let sequenceId = 'tier-b-nurture';
    if (tier === 'A') sequenceId = 'tier-a-first-touch';
    if ((input.newStatus || '').toLowerCase().includes('re-engage')) sequenceId = 're-engage';
    if ((input.newStatus || '').toLowerCase().includes('qualified')) sequenceId = 'closer';

    // Outcome timeout: hot leads get 24h, others get 48h
    const outcomeTimeoutMs = tier === 'A'
      ? 24 * 60 * 60 * 1000
      : 48 * 60 * 60 * 1000;

    const context = {
      issueId: input.issueId,
      issueIdentifier: input.issueIdentifier,
      leadEmail: input.leadEmail || (lead && lead.email) || null,
      leadName: input.leadName || (lead && lead.name) || null,
      score,
      tier,
      segment,
      sequenceId,
      outcomeTimeoutMs,
      platform: (lead && lead.platform) || 'linkedin',
      leadData: lead || {},
      resolvedFrom: lead ? 'crm' : 'issue_metadata',
      resolvedAt: new Date().toISOString(),
    };

    observability.metrics.increment('outbound.lead.resolved', 1, {
      issueId: input.issueId,
      tier,
      sequenceId,
    });

    // Persist lead state for the chain
    await store.set(`outbound:lead:${input.issueId}`, context);

    return context;
  }

  // ---------------------------------------------------------------
  // Activity: executeOutreachSequence
  // ---------------------------------------------------------------
  async function executeOutreachSequence(input = {}) {
    const { leadContext, issueId, issueIdentifier, newStatus } = input;
    const sequenceId = leadContext.sequenceId || 'tier-b-nurture';
    const sequence = SEQUENCES[sequenceId];

    if (!sequence) {
      observability.logger.warn('outbound.sequence.notFound', { sequenceId, issueId });
      return {
        sequenceCompleted: false,
        stepsExecuted: 0,
        sequenceId,
        reason: `Sequence "${sequenceId}" not found`,
      };
    }

    observability.logger.info('outbound.sequence.start', {
      issueId,
      issueIdentifier,
      sequenceId,
      sequenceName: sequence.name,
      totalSteps: sequence.steps.length,
      tier: leadContext.tier,
    });

    const executedSteps = [];

    for (let i = 0; i < sequence.steps.length; i++) {
      const step = sequence.steps[i];

      // Log the step execution (actual send is handled by the outreach
      // integrations - LinkedIn Composio, email engine, etc.)
      // This activity records the intent and queues the action.
      const stepResult = {
        stepIndex: i,
        delay: step.delay,
        type: step.type,
        channel: step.channel,
        template: step.template,
        leadEmail: leadContext.leadEmail,
        leadName: leadContext.leadName,
        tier: leadContext.tier,
        executedAt: new Date().toISOString(),
        status: 'queued',
      };

      // For delay=0 steps (immediate), mark as executed.
      // For delayed steps, they get picked up by the heartbeat workflows
      // on subsequent beats.
      if (step.delay === 0) {
        stepResult.status = 'executed';
      } else {
        stepResult.status = 'scheduled';
        stepResult.scheduledFor = new Date(
          Date.now() + step.delay * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      executedSteps.push(stepResult);

      observability.metrics.increment('outbound.sequence.step', 1, {
        issueId,
        sequenceId,
        stepIndex: String(i),
        status: stepResult.status,
      });
    }

    // Persist the sequence state
    await store.set(`outbound:sequence:${issueId}`, {
      issueId,
      issueIdentifier,
      sequenceId,
      sequenceName: sequence.name,
      steps: executedSteps,
      startedAt: new Date().toISOString(),
      leadTier: leadContext.tier,
      leadEmail: leadContext.leadEmail,
    });

    observability.logger.info('outbound.sequence.complete', {
      issueId,
      sequenceId,
      stepsExecuted: executedSteps.filter((s) => s.status === 'executed').length,
      stepsScheduled: executedSteps.filter((s) => s.status === 'scheduled').length,
    });

    return {
      sequenceCompleted: true,
      stepsExecuted: executedSteps.length,
      stepsImmediate: executedSteps.filter((s) => s.status === 'executed').length,
      stepsScheduled: executedSteps.filter((s) => s.status === 'scheduled').length,
      sequenceId,
      sequenceName: sequence.name,
      steps: executedSteps,
    };
  }

  return {
    validateStatusTransition,
    dedupeOutboundExecution,
    releaseOutboundExecution,
    resolveLeadContext,
    executeOutreachSequence,
  };
}

module.exports = {
  createOutboundChainActivities,
  ACTIONABLE_TRANSITIONS,
  SEQUENCES,
  SCORE_THRESHOLDS,
  ALLOWED_PROJECT_NAMES,
};
