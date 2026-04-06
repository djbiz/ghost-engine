# Temporal foundation

Ghost Engine's Phase 2 Temporal layer is scaffolded here.

## Environment

- `TEMPORAL_ADDRESS` - Temporal server address, default `localhost:7233`
- `TEMPORAL_NAMESPACE` - Temporal namespace, default `ghost-engine`
- `TEMPORAL_TASK_QUEUE` - task queue for campaign workflows, default `ghost-engine-campaigns`
- `TEMPORAL_STATE_PATH` - JSON state store path used by the foundation layer

## Scripts

- `npm run temporal:bootstrap`
- `npm run temporal:worker`

## Modules

- `temporal/campaign-workflow.js` - campaign workflow wrapper
- `temporal/retry-policy.js` - shared retry policy helper
- `temporal/dedupe.js` - idempotency helper
- `temporal/state-store.js` - JSON state store adapter
- `temporal/observability.js` - logging / metrics / tracing helpers
- `temporal/activities.js` - activity implementations and state integration
