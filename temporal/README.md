# Temporal foundation

Ghost Engine's Temporal layer now covers Phase 3 (heartbeats) and Phase 4 (outbound chain).

## Environment

- `TEMPORAL_PROFILE` - optional Temporal profile name, use `cloud` for Derek's Temporal Cloud setup
- `TEMPORAL_ADDRESS` - Temporal server address; set this to the cloud endpoint or profile-backed address
- `TEMPORAL_NAMESPACE` - Temporal namespace for Ghost Engine's cloud instance
- `TEMPORAL_API_KEY` - Temporal Cloud API key/token for worker authentication
- `TEMPORAL_TLS` - enable TLS when connecting to Temporal Cloud
- `TEMPORAL_TASK_QUEUE` - shared queue for campaign and heartbeat workflows, default `ghost-engine-campaigns`
- `TEMPORAL_STATE_PATH` - JSON state store path used by the foundation layer
- `LINEAR_API_KEY` - Linear API key for issue updates and comments (Phase 4)
- `LINEAR_WEBHOOK_SECRET` - webhook signing secret from Linear (Phase 4)
- `WEBHOOK_PORT` - HTTP port for the Linear webhook listener, default `3847`

## Scripts

- `npm run temporal:bootstrap`
- `npm run temporal:worker`
- `npm run temporal:webhook` - starts the Linear webhook listener (Phase 4)

## Modules

### Foundation (Phase 2)
- `temporal/campaign-workflow.js` - campaign workflow wrapper
- `temporal/retry-policy.js` - shared retry policy helper
- `temporal/dedupe.js` - idempotency helper
- `temporal/state-store.js` - JSON state store adapter
- `temporal/observability.js` - logging / metrics / tracing helpers
- `temporal/activities.js` - campaign activity implementations and state integration
- `temporal/config.js` - Temporal connection and environment config

### Heartbeats (Phase 3)
- `temporal/heartbeat-workflows.js` - durable heartbeat, summary, and sync workflows
- `temporal/heartbeat-activities.js` - heartbeat snapshot, summary, and sync activities

### Outbound Chain (Phase 4)
- `temporal/outbound-chain-workflow.js` - Linear status change -> outreach sequence -> Linear update
- `temporal/outbound-chain-activities.js` - validate transitions, resolve leads, execute sequences, dedupe
- `temporal/linear-activities.js` - Linear API integration (update issue state, post comments)
- `temporal/linear-webhook-listener.js` - thin HTTP server that receives Linear webhooks and starts workflows

### Existing Activity Factories (restored in Phase 4 fix)
- `temporal/score-decay-activities.js` - lead score decay over time
- `temporal/sunday-evolution-activities.js` - weekly evolution report
- `temporal/nightly-consolidation-activities.js` - nightly data consolidation
- `temporal/proof-loop-activities.js` - legacy CRM-based proof loop (reads data/crm.csv)
- `temporal/pipeline-automation-activities.js` - pipeline automation rules
- `temporal/content-engine-activities.js` - content generation engine
- `temporal/linkedin-engagement-activities.js` - LinkedIn engagement tracking
- `temporal/momentum-controller-activities.js` - momentum tracking and control

### Shared
- `temporal/workflows.js` - combined workflow export for the worker
- `temporal/worker.js` - worker factory registering all activities (Phase 2-4 + 8 existing factories)
- `temporal/index.js` - barrel export

## Phase 3 coverage

The Temporal worker absorbs the low-stakes PM2 beats that used to live in scripts such as:

- `scripts/heartbeat-morning.js`
- `scripts/heartbeat-closer.js`
- `scripts/heartbeat-fulfillment.js`
- `scripts/heartbeat-night.js`
- `scripts/daily-runner.js`
- `scripts/nightly-consolidation.js`
- `scripts/pipeline-automation.js`

These are now handled as durable workflows and activities so the operational state can survive restarts and retries.

## Phase 4 coverage

The outbound chain replaces the manual Linear-to-script pipeline:

**Flow:**
```
Linear (GHO) issue status change
  -> Webhook listener (PM2, stateless)
  -> Temporal: outboundChainWorkflow
     1. validateStatusTransition - filter actionable changes
     2. dedupeOutboundExecution - prevent duplicate runs
     3. resolveLeadContext - pull lead data, assign tier/sequence
     4. executeOutreachSequence - run tier-appropriate DM/email steps
     5. completeLinearIssue - move to "Done" + post execution log
```

**Actionable status transitions:**
- Outreach / Outreach Sent -> start sequence
- Qualified -> start closer sequence
- Re-engage -> start re-engage sequence
- Won / Closed Won -> trigger proof loop
- Signal Detected -> human breakpoint alert

**Idempotency:** Dedupe on `issueId + statusTransition` so duplicate webhooks are harmless.

**State:** Persisted per-lead in the JSON state store so restarts resume mid-sequence.

## Linear webhook setup

1. Go to Linear Settings -> API -> Webhooks
2. Create webhook: `https://<your-server>:3847/linear/webhook`
3. Select events: Issue (state changes)
4. Copy the signing secret to `LINEAR_WEBHOOK_SECRET` env var
5. Start the listener: `node temporal/linear-webhook-listener.js`
