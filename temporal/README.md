# Temporal foundation

Ghost Engine's Phase 2 foundation now powers the Phase 3 heartbeat migration.

## Environment

- `TEMPORAL_PROFILE` - optional Temporal profile name, use `cloud` for Derek's Temporal Cloud setup
- `TEMPORAL_ADDRESS` - Temporal server address; set this to the cloud endpoint or profile-backed address
- `TEMPORAL_NAMESPACE` - Temporal namespace for Ghost Engine's cloud instance
- `TEMPORAL_API_KEY` - Temporal Cloud API key/token for worker authentication
- `TEMPORAL_TLS` - enable TLS when connecting to Temporal Cloud
- `TEMPORAL_TASK_QUEUE` - shared queue for campaign and heartbeat workflows, default `ghost-engine-campaigns`
- `TEMPORAL_STATE_PATH` - JSON state store path used by the foundation layer

## Scripts

- `npm run temporal:bootstrap`
- `npm run temporal:worker`

## Modules

- `temporal/campaign-workflow.js` - campaign workflow wrapper
- `temporal/heartbeat-workflows.js` - durable heartbeat, summary, and sync workflows
- `temporal/retry-policy.js` - shared retry policy helper
- `temporal/dedupe.js` - idempotency helper
- `temporal/state-store.js` - JSON state store adapter
- `temporal/observability.js` - logging / metrics / tracing helpers
- `temporal/activities.js` - campaign activity implementations and state integration
- `temporal/heartbeat-activities.js` - heartbeat snapshot, summary, and sync activities
- `temporal/workflows.js` - combined workflow export for the worker

## Phase 3 coverage

The Temporal worker now absorbs the low-stakes PM2 beats that used to live in scripts such as:

- `scripts/heartbeat-morning.js`
- `scripts/heartbeat-closer.js`
- `scripts/heartbeat-fulfillment.js`
- `scripts/heartbeat-night.js`
- `scripts/daily-runner.js`
- `scripts/nightly-consolidation.js`
- `scripts/pipeline-automation.js`

These are now handled as durable workflows and activities so the operational state can survive restarts and retries.
