# Three-Layer Memory System — Zo Agent Architecture

## 1. Overview
Ghost Engine's AI COO "Zo" uses a three-layer persistent memory system inspired by a Felix-Style boot approach. Each layer serves a distinct purpose and has different update frequencies:
- **SOUL.md** (Layer 3 / Deepest): Core personality and values. Updated weekly.
- **IDENTITY.md** (Layer 2 / Operational): Role definition, ownership, guardrails. Updated on strategy shifts.
- **BOOTSTRAP.md** (Layer 1 / Session): Hot context loaded every boot. Updated every heartbeat.

Memory loads bottom-up on boot: BOOTSTRAP → IDENTITY → SOUL. This gives Zo fast operational context first, then progressively deeper identity layers.

## 2. Layer 3: SOUL.md — Core Identity
**Path:** `system/SOUL.md` (2703 bytes)
**Update Frequency:** Weekly (Sunday Evolution cycle only)
**Read Access:** All heartbeats, all agents
**Write Access:** Sunday Evolution agent only

Defines WHO Zo is at a fundamental level:
- **Core Personality**: Street-smart, direct, speed-obsessed co-founder voice
- **Communication Style**: Short punchy sentences, numbers-first reporting, no hedging, no corporate jargon
- **DO rules**: Lead with data, be direct, use casual confident tone
- **NEVER rules**: No filler words, no hedging language, no corporate speak
- **Response Framing**: Templates for good vs bad responses
- **Tacit Knowledge Triggers**: Pattern-matching table for contextual responses

SOUL.md is the most stable layer. Changes here represent genuine evolution in Zo's character and approach, not daily operational shifts.

## 3. Layer 2: IDENTITY.md — Operational Identity
**Path:** `system/IDENTITY.md` (2106 bytes)
**Update Frequency:** As needed when strategies shift
**Read Access:** All heartbeats, all agents
**Write Access:** Operator (Derek) or strategic update triggers

Defines HOW Zo operates day-to-day:
- **Role**: AI COO for Ghost Monetization Engine, operates under Derek's strategic direction
- **Ownership Domains**: Lead Pipeline, Outreach Machine, Close Support, Fulfillment, Proof Generation, System Integrity
- **Guardrails** (non-negotiable): No money movement, no pricing changes, no personal social posting, no API key exposure without approval
- **KPIs**: 5+ leads/day, 3+ conversations/day, 1+ discovery calls/week, first $990 close, first case study
- **Decision Authority**: What Zo can decide autonomously vs what requires Derek's input

IDENTITY.md bridges the gap between Zo's core personality (SOUL) and daily execution (BOOTSTRAP). It changes when the business pivots strategy but remains stable across normal operational days.

## 4. Layer 1: BOOTSTRAP.md — Session Boot
**Path:** `system/BOOTSTRAP.md` (3041 bytes)
**Update Frequency:** Every heartbeat cycle (4x daily minimum)
**Read Access:** First file loaded on every session
**Write Access:** Every heartbeat, Nightly Consolidator

Implements the Felix-Style Startup Sequence (inspired by Nat Eliason's memory-first approach). On every boot, Zo loads context in this order:

1. **MEMORY.md** — Long-term facts and persistent knowledge
2. **Today's daily note** — Current day operational context from `daily/`
3. **Leads/Clients CRM state** — Pipeline data from `leads/` and `clients/`
4. **Yesterday's pending actions** — Unresolved items carried forward
5. **Start conversation** — Zo greets with a status-aware opening based on loaded context

BOOTSTRAP.md is the most volatile layer. It reflects the current state of operations and is rewritten frequently to keep Zo's working memory accurate and actionable.

## 5. Boot Sequence
On every new session, Zo executes the following boot order:

```
[BOOT START]
  1. Load system/BOOTSTRAP.md        → Hot operational context
  2. Load system/IDENTITY.md         → Role, guardrails, KPIs
  3. Load system/SOUL.md             → Core personality layer
  4. Load system/MEMORY.md           → Persistent long-term facts
  5. Load daily/{YYYY-MM-DD}.md      → Today's operational note
  6. Scan leads/ and clients/        → CRM pipeline state
  7. Check pending actions           → Carry-forward items
  8. Generate status-aware greeting  → Ready for conversation
[BOOT COMPLETE]
```

This sequence ensures Zo never starts a session "cold." Every interaction begins with full context awareness, from today's pipeline state to long-term personality consistency.

## 6. Memory Update Cycles

| Cycle | Frequency | Trigger | Layers Affected | Description |
|-------|-----------|---------|-----------------|-------------|
| **Heartbeat** | 4x daily (every 6 hours) | Cron schedule | BOOTSTRAP.md, daily notes | Refreshes operational state, updates pipeline numbers, logs actions taken |
| **Nightly Consolidation** | 1x daily (midnight) | End-of-day trigger | BOOTSTRAP.md, MEMORY.md, daily notes | Summarizes the day, promotes important facts to MEMORY.md, archives completed items |
| **Weekly Evolution** | 1x weekly (Sunday) | Sunday Evolution agent | SOUL.md, IDENTITY.md | Reviews week's performance, evolves personality patterns, adjusts KPI targets if needed |
| **Strategy Shift** | As needed | Derek (manual) | IDENTITY.md | Updates role definition, ownership domains, or guardrails when business strategy changes |

## 7. Directory Structure

```
ghost-engine/
├── system/
│   ├── SOUL.md              # Layer 3: Core personality (weekly updates)
│   ├── IDENTITY.md          # Layer 2: Operational identity (strategy shifts)
│   ├── BOOTSTRAP.md         # Layer 1: Session boot context (every heartbeat)
│   ├── MEMORY.md            # Long-term persistent facts
│   └── MEMORY-SYSTEM.md     # This document — architecture reference
├── daily/
│   ├── 2026-04-05.md        # Today's operational note
│   ├── 2026-04-04.md        # Yesterday
│   └── ...                  # Rolling daily notes
├── leads/
│   ├── {lead-name}.md       # Individual lead files with status tracking
│   └── ...
├── clients/
│   ├── {client-name}.md     # Active client files
│   └── ...
└── templates/
    └── ...                  # Response templates and playbooks
```

## 8. Heartbeat System
The heartbeat is Zo's primary operational pulse. It runs 4x daily and performs:

1. **State Snapshot**: Captures current pipeline numbers (leads, conversations, calls)
2. **Action Log**: Records actions taken since last heartbeat
3. **BOOTSTRAP Refresh**: Rewrites BOOTSTRAP.md with latest state
4. **Daily Note Update**: Appends new entries to today's `daily/` note
5. **Pending Action Scan**: Identifies carry-forward items for next cycle
6. **Alert Check**: Flags anything requiring Derek's immediate attention

Each heartbeat is idempotent — running it twice produces the same state. This makes the system resilient to missed or duplicate triggers.

## 9. Nightly Consolidation
The Nightly Consolidator runs at midnight and performs end-of-day housekeeping:

1. **Day Summary**: Generates a concise summary of the day's activities and outcomes
2. **Fact Promotion**: Identifies important new facts and promotes them to MEMORY.md
3. **Pending Rollover**: Moves unresolved action items to the next day's context
4. **Metric Logging**: Records daily KPI snapshots for trend analysis
5. **Stale Data Cleanup**: Archives completed leads and resolved items
6. **BOOTSTRAP Reset**: Prepares a clean BOOTSTRAP.md for the next morning's first heartbeat

The consolidator ensures no context is lost between days while keeping working memory lean.

## 10. Sunday Evolution
The weekly Sunday Evolution cycle is the only process that modifies SOUL.md:

1. **Week-in-Review**: Analyzes the full week's daily notes, metrics, and outcomes
2. **Pattern Detection**: Identifies recurring situations that need new tacit knowledge triggers
3. **Voice Calibration**: Reviews Zo's communication patterns against SOUL.md guidelines
4. **KPI Assessment**: Evaluates progress toward targets, recommends adjustments to IDENTITY.md
5. **SOUL Update**: Writes any personality or style evolutions back to SOUL.md
6. **IDENTITY Review**: Proposes guardrail or ownership changes if warranted (requires Derek approval)

Sunday Evolution is the mechanism by which Zo genuinely improves over time, not just operationally but in character and judgment.

## 11. Design Principles

1. **Memory-First, Always**: Zo never operates without loading context. Every session starts with the boot sequence. No cold starts.
2. **Layered Stability**: Deeper layers change less frequently. SOUL evolves weekly, IDENTITY shifts with strategy, BOOTSTRAP updates constantly. This prevents personality drift from daily noise.
3. **Bottom-Up Loading**: Boot loads the most volatile layer first (BOOTSTRAP) so Zo has immediate operational awareness, then progressively loads stable identity layers.
4. **Separation of Concerns**: Each layer has a single responsibility. SOUL defines WHO, IDENTITY defines HOW, BOOTSTRAP defines WHAT RIGHT NOW.
5. **Idempotent Updates**: All update cycles can be safely re-run. No side effects from duplicate heartbeats or consolidation runs.
6. **Human-in-the-Loop**: Critical changes (guardrails, strategy, pricing authority) always require Derek's approval. Zo optimizes within boundaries, not around them.
7. **Transparent State**: All memory is stored as readable Markdown files in the repository. Nothing is hidden in opaque databases. Any team member can read Zo's full context at any time.
8. **Graceful Degradation**: If a layer fails to load, Zo can still operate with reduced context rather than failing completely. BOOTSTRAP alone provides enough to be useful.

---

*This document describes the memory architecture as of 2026-04-05. For operational procedures, see individual layer files in `system/`.*
