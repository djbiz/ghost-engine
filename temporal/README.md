# Temporal foundation

Ghost Engine's Temporal layer covers Phase 3 (heartbeats), Phase 4 (outbound chain), and Phase 5 (pipeline lifecycle, proof loop, signal detection).

## Environment

- `TEMPORAL_PROFILE` - optional Temporal profile name, use `cloud` for Derek's Temporal Cloud setup
- `TEMPORAL_ADDRESS` - Temporal server address; set this to the cloud endpoint or profile-backed address
- `TEMPORAL_NAMESPACE` - Temporal namespace for Ghost Engine's cloud instance
- `TEMPORAL_API_KEY` - Temporal Cloud API key/token for worker authentication
- `TEMPORAL_TLS` - enable TLS when connecting to Temporal Cloud
- `TEMPORAL_TASK_QUEUE` - shared queue for all workflows, default `ghost-engine-campaigns`
- `TEMPORAL_STATE_PATH` - JSON state store path used by the foundation layer
- `LINEAR_API_KEY` - Linear API key for issue updates and comments (Phase 4+)
- `LINEAR_WEBHOOK_SECRET` - webhook signing secret from Linear (Phase 4+)
- `WEBHOOK_PORT` - HTTP port for the Linear webhook listener, default `3847`

## Scripts

- `npm run temporal:bootstrap`
- `npm run temporal:worker`
- `npm run temporal:webhook` - starts the Linear webhook listener

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

### Existing Activity Factories (Phase 4 fix)
- `temporal/score-decay-activities.js`
- `temporal/sunday-evolution-activities.js`
- `temporal/nightly-consolidation-activities.js`
- `temporal/proof-loop-activities.js` - legacy CRM-based proof loop (reads data/crm.csv)
- `temporal/pipeline-automation-activities.js`
- `temporal/content-engine-activities.js`
- `temporal/linkedin-engagement-activities.js`
- `temporal/momentum-controller-activities.js`

### Pipeline Lifecycle (Phase 5)
- `temporal/pipeline-lifecycle-workflow.js` - hourly cron: score leads, detect stale, escalate hot, check calls, evaluate proof trigger
- `temporal/pipeline-lifecycle-activities.js` - snapshot, scoring, stale detection, hot lead escalation, speed close, proof loop evaluation

### Proof Loop - Temporal Native (Phase 5)
- `temporal/proof-loop-workflow.js` - deal won -> case study + 3 authority posts + breakdown + Blotato queue + close log
- `temporal/proof-loop-temporal-activities.js` - client resolution, content generation, memory/lessons update, close log persistence
- Note: coexists with the legacy `proof-loop-activities.js`; export is `createProofLoopTemporalActivities` to avoid collision

### Signal Detection (Phase 5)
- `temporal/signal-detection-workflow.js` - reply/intent detection + human breakpoint + speed close DM
- `temporal/signal-detection-activities.js` - keyword classification, breakpoint alerting, speed close queuing, chain state updates

### Shared
- `temporal/workflows.js` - combined workflow export for the worker
- `temporal/worker.js` - worker factory registering all activities (Phase 2-5)
- `temporal/index.js` - barrel export

## Phase 3 coverage

The Temporal worker absorbs the low-stakes PM2 beats that used to live in scripts such as:

- `scripts/heartbeat-morning.js`
- `scripts/heartbeat-closer.js`
- `scripts/heartbeat-fulfillment.js`
- `scripts/heartbeat-night.js`
- `scripts/daily-runner.js`
- `scripts/nightly-consolidation.js`

## Phase 4 coverage

The outbound chain replaces the manual Linear-to-script pipeline:

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

## Phase 5 coverage

### Pipeline Lifecycle (replaces `scripts/pipeline-automation.js`)

Runs on a Temporal cron schedule (every hour). Replaces the PM2 hourly cron.

```
pipelineLifecycleWorkflow (cron: 0 * * * *)
  1. capturePipelineSnapshot - read CRM, inbound, discovery, close log
  2. scoreInboundLeads - flag unprocessed leads
  3. detectStaleLeads - 48h+ no contact -> queue re-engagement
  4. escalateHotLeads - score >= 85 -> alert queue
  5. checkDiscoveryCalls - unconfirmed bookings -> follow up
  6. detectSpeedCloseSignals - Stripe click, fast reply, pricing ask
  7. evaluateProofLoopTrigger - 3+ closes -> trigger proof loop
  8. persistPipelineSummary - actions + state store write
```

**PM2 scripts killed:**
- `scripts/pipeline-automation.js` (hourly cron)
- `scripts/automation-hot-lead-alert.js` (escalation)
- `scripts/speed-close-trigger.js` (speed close detection)

### Proof Loop Temporal (replaces `scripts/proof-loop.js` + `scripts/automation-proof-loop.js`)

Triggered by deal close (Linear "Done"/"Won" or Stripe payment confirmed).

```
proofLoopWorkflow
  1. resolveClientContext - enrich from clients/active.csv
  2. generateCaseStudy - markdown case study in proof/
  3. generateAuthorityPosts - 3 LinkedIn authority posts in proof/
  4. generateBreakdown - carousel breakdown in proof/
  5. queueProofContent - queue to Blotato state store
  6. postLinearComment - execution log on the deal issue
  7. updateMemoryAndLessons - MEMORY.md + lessons-learned.md
  8. appendCloseLog - close-log.jsonl entry
```

**PM2 scripts killed:**
- `scripts/proof-loop.js`
- `scripts/automation-proof-loop.js`

### Signal Detection (replaces GHO-27 Agent 3 + GHO-29 Human Breakpoint)

Two modes: event-driven (single signal) or batch scan (cron every 2h).

```
signalDetectionWorkflow (mode: event | scan)

  Event mode (webhook-triggered):
    1. classifySignal - keyword matching against 18 intent keywords
    2. triggerHumanBreakpoint - if hot: pause automation, alert Derek
    3. queueSpeedCloseDM - if speed-close signal: queue accelerated DM
    4. updateOutboundChainState - pause scheduled sequence steps
    5. postLinearComment - signal log on issue

  Scan mode (cron every 2h):
    1. scanForNewSignals - check CRM for new replies, Stripe clicks, call bookings
    2. classifySignal (per signal)
    3. triggerHumanBreakpoint (per hot signal)
    4. queueSpeedCloseDM (per speed-close signal)
    5. persistScanSummary
```

**Intent keywords (from GHO-27 spec):**
"yeah", "we are struggling", "not really organized", "kinda messy", "this is interesting", "tell me more", "how does it work", "curious", "interested", "what does it cost", "send me details", "let's talk", "can we chat", "book a call", "i'm in", "sign me up", "sounds good", "when can we start"

**PM2 scripts killed:**
- `scripts/automation-hot-lead-alert.js`
- `scripts/automation-speed-close.js`

## PM2 retirement plan

After Phase 5, only ONE PM2 process remains:

| Process | Status |
|---|---|
| `temporal/linear-webhook-listener.js` | **Keep on PM2** (thin, stateless HTTP listener) |
| `scripts/pipeline-automation.js` | **Kill** -> `pipelineLifecycleWorkflow` |
| `scripts/proof-loop.js` | **Kill** -> `proofLoopWorkflow` |
| `scripts/automation-proof-loop.js` | **Kill** -> `proofLoopWorkflow` |
| `scripts/automation-hot-lead-alert.js` | **Kill** -> `pipelineLifecycleWorkflow` + `signalDetectionWorkflow` |
| `scripts/automation-speed-close.js` | **Kill** -> `signalDetectionWorkflow` |
| `scripts/speed-close-trigger.js` | **Kill** -> `pipelineLifecycleWorkflow` |
| Heartbeat scripts | **Already killed** (Phase 3) |

Everything else runs as durable Temporal workflows with built-in retry, state persistence, and observability.

## Linear webhook setup

1. Go to Linear Settings -> API -> Webhooks
2. Create webhook: `https://<your-server>:3847/linear/webhook`
3. Select events: Issue (state changes)
4. Copy the signing secret to `LINEAR_WEBHOOK_SECRET` env var
5. Start the listener: `node temporal/linear-webhook-listener.js`

## Cron schedules (configure in Temporal UI or via client)

| Workflow | Schedule | Purpose |
|---|---|---|
| `pipelineLifecycleWorkflow` | `0 * * * *` (every hour) | Pipeline health check |
| `signalDetectionWorkflow` (scan mode) | `0 */2 * * *` (every 2h) | Batch signal scan |
