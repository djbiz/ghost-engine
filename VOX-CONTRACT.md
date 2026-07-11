# VOX Contract — Ghost Engine

## Purpose

Define the relationship between VOX and Ghost Engine.

Ghost Engine is not an intelligence layer.
Ghost Engine is not a decision maker.
Ghost Engine is not an autonomous operator.

Ghost Engine may only exist as an execution capability layer when it provides measurable value beyond existing execution infrastructure (Activepieces).

---

## Authority model

### VOX owns

- Mission, identity, principles
- Memory interpretation
- Reasoning and recommendations
- Decision framework
- Approval requirements

VOX answers: **"What should happen?"**

---

### Runner owns

- Workflow coordination
- Agent assignment
- Task routing
- Lifecycle management

Runner answers: **"Who should handle this?"**

---

### Activepieces (Execution Gateway) owns

- API calls to external systems
- Approved action execution
- Credential handling
- Standard automation flows

Activepieces answers: **"How does the approved action happen?"**

---

### Ghost Engine (if retained) owns

Only:

- Durable workflow execution (long-running, stateful, retry-heavy)
- Complex multi-step operations not suitable for a linear automation flow
- Execution functions requiring Temporal-backed checkpointing and recovery

Ghost Engine answers: **"Can this specialized durable capability be executed?"**

---

## Non-negotiable rules

Ghost Engine MUST NOT:

- Make strategic decisions
- Generate autonomous business priorities
- Override VOX decisions
- Access unrestricted memory
- Contact customers without an approved capability call
- Modify VOX governance files
- Create its own objectives

---

## Required input contract

Every Ghost Engine request must contain:

```json
{
  "request_id": "string",
  "capability_name": "string",
  "requested_action": "string",
  "approval_state": "approved | pending | denied",
  "source_context": "string",
  "timestamp": "ISO 8601"
}
```

---

## Required output contract

Every execution must return:

```json
{
  "request_id": "string",
  "capability_name": "string",
  "execution_status": "success | failed | partial",
  "result": "object",
  "errors": "array",
  "timestamp": "ISO 8601",
  "learning_data": "object"
}
```

---

## Decision test

Ghost Engine earns its place only if:

1. It provides capability Activepieces cannot easily provide
2. It reduces operational complexity
3. It improves measurable outcomes
4. It remains subordinate to VOX governance

If any condition fails: archive and retire to `legacy/`.

---

## The test question

Before adding any capability to Ghost Engine, answer:

> "Why does this run in Ghost Engine instead of Activepieces?"

If the answer is unclear, it does not belong here.
