# Ghost Engine

**Durable execution runtime for VOX.**

Ghost Engine is a Temporal-backed worker that runs long-lived, stateful workflows on behalf of VOX. It does not decide anything. It does not own customers. It executes named capabilities and returns results.

---

## Role in the VOX architecture

```
VOX               →  thinks, decides, recommends
Runner            →  coordinates, routes, manages lifecycle
Activepieces      →  connects to external APIs (CRM, Slack, ClickUp, Notion, email, etc.)
Ghost Engine      →  persists difficult work (durable workflows, retries, compensation, checkpointing)
```

Every action Ghost Engine executes originates from a VOX decision, is approved through Runner, and is dispatched with an explicit capability contract.

---

## What Ghost Engine is for

Use Ghost Engine when the work is:

- **Long-running** — spans hours or days
- **Stateful** — requires resumption after crash or restart
- **Retry-heavy** — needs deterministic backoff and compensation
- **Multi-step with branching** — where a linear automation flow is the wrong shape

Reference workload: the outbound chain (lead qualified → wait 24h → check state → branch → retry / escalate / complete).

## What Ghost Engine is not for

Anything that fits inside an Activepieces flow. That includes:

- CRM record creates and updates
- Slack, iMessage, WhatsApp messages
- ClickUp task creation
- Notion page updates
- Standard API calls
- Lead routing
- Email dispatch

If Activepieces can do it in one flow, Activepieces owns it.

---

## Non-negotiable rules

Ghost Engine must not:

1. Make strategic decisions
2. Generate autonomous business priorities
3. Override VOX governance
4. Contact customers without an approved capability call
5. Modify VOX memory or governance files
6. Create its own objectives

The `Zo autonomous COO` positioning is retired. See `legacy/` for the archived version.

---

## Capability contract

Every request into Ghost Engine carries:

```
request_id
capability_name
requested_action
approval_state
source_context
timestamp
```

Every response returns:

```
request_id
capability_name
execution_status
result
errors
timestamp
learning_data
```

See `VOX-CONTRACT.md` for the full governance boundary.

---

## Repository status

- **Runtime:** Temporal worker
- **Language:** Node.js
- **Last significant change:** 2026-04-12 (pre-VOX architecture)
- **Current phase:** Reconciliation — identity updated; code audit and VOX integration pending

## Directory layout (target state)

```
ghost-engine/
├── capabilities/       # Named, approved capabilities Ghost Engine executes
├── workflows/          # Temporal workflow definitions
├── activities/         # Temporal activity implementations
├── adapters/           # Connections to Activepieces, HubSpot, Airtable, etc.
├── telemetry/          # Execution logs, learning_data emission
├── legacy/             # Archived Zo / autonomous COO era code
├── VOX-CONTRACT.md     # Governance boundary
└── README.md
```

Everything outside `legacy/` must conform to the capability contract.

---

## License

Proprietary. © 2026 Derek Jamieson. All rights reserved.
