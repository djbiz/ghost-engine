# MEMORY-CATALOG.md -- Ghost Engine 3-Layer Memory System

> Auto-generated from source files: `BOOTSTRAP.md`, `IDENTITY.md`, `SOUL.md`
> Generated: 2026-04-06

---

## Overview

The Ghost Engine memory system uses a **3-layer architecture** to give Zo (the AI COO) persistent context across sessions. Each layer serves a distinct purpose and has different mutability characteristics:

1. **BOOTSTRAP** (`system/BOOTSTRAP.md`) -- The startup sequence script that runs at the start of every session. It orchestrates what gets loaded and in what order. As stated in its header: *"This is the single most important file in the Ghost Engine system."* It implements Nat Eliasen's key insight: "Get the memory structure in first because then your conversations from day one will be useful."

2. **IDENTITY** (`system/IDENTITY.md`) -- Defines who Zo is: role (AI COO), responsibilities, boundaries, success metrics, and failure signals. Sets the operational mandate: *"You're going to sleep. Build a money machine."*

3. **SOUL** (`system/SOUL.md`) -- Defines Zo's personality, communication style, response framing rules, and tacit knowledge triggers. Ensures consistent voice: *"When Zo responds as Ghost Engine, this is WHO HE IS."*

---

## Layer Map

| Layer | File | Purpose | Update Frequency | Mutability |
|-------|------|---------|-----------------|------------|
| 1 -- BOOTSTRAP | `system/BOOTSTRAP.md` | Session startup sequence; loads memory, daily notes, CRM, and pending actions | Rare -- only when boot logic changes | Low (structural) |
| 2 -- IDENTITY | `system/IDENTITY.md` | Role definition, ownership scope, boundaries, KPIs, failure signals | Infrequent -- when responsibilities shift | Medium (operational) |
| 3 -- SOUL | `system/SOUL.md` | Personality, voice, communication rules, tacit knowledge | Rare -- core personality is stable | Low (character) |

---

## Layer 1: BOOTSTRAP

**File:** `system/BOOTSTRAP.md`
**Format:** Node.js executable script with embedded documentation

### Purpose

Executes the Felix-Style Startup Sequence at the beginning of every session. Ensures Zo is fully oriented before any conversation begins.

### Key Sections (extracted from code structure)

| Section | Description |
|---------|-------------|
| **Header / Run Order** | Documents the 5-step boot sequence in code comments |
| **Layer 1 Load (MEMORY.md)** | Reads long-term facts: business state, identity, hard rules, operating principles |
| **Layer 2 Load (Daily Note)** | Reads today's daily note (`daily/YYYY-MM-DD.md`) for session context |
| **Layer 3 Load (Pipeline State)** | Reads `leads/crm.csv`, `clients/active.csv`, and `leads/inbound.csv` for pipeline state |
| **Yesterday's Pending Actions** | Checks previous day's daily note for PENDING/TODO items requiring follow-up |
| **Boot Complete Signal** | Logs "BOOTSTRAP COMPLETE -- Zo is fully oriented" |

### Update Protocol

- Modified only when the boot sequence logic itself needs to change (e.g., new data sources, new load order steps).
- Changes require testing the full startup path to ensure no regressions.

---

## Layer 2: IDENTITY

**File:** `system/IDENTITY.md`
**Format:** Structured markdown with tables

### Purpose

Defines Zo's operational identity as AI COO for the Ghost Monetization Engine. Establishes what Zo owns, what requires approval, and how to measure success and detect failures.

### Key Sections (extracted from actual headings)

| Section | Description |
|---------|-------------|
| **My Job** | Core mandate: run the Ghost Monetization Engine autonomously. Derek provides strategic vision; Zo executes without stopping. |
| **What I Own** | 6 responsibility areas: Lead Pipeline, Outreach Machine, Close Support, Fulfillment, Proof Generation, System Integrity |
| **What I DON'T Touch Without Asking** | 4 guardrails: Money movement (Stripe read-only), New pricing, Personal social accounts, API keys |
| **How I Know I'm Winning** | 5 KPIs: 5+ new leads/day, 3+ conversations started/day, 1+ discovery calls booked/week, First $990 close, First case study |
| **How I Know Something Is Broken** | 5 failure signals with prescribed actions: Route 500s, stalled lead count, SMS failures, missing agent reports, silent Stripe webhooks |

### Update Protocol

- Updated when Zo's responsibilities expand or contract.
- Boundary changes (the "DON'T Touch" list) require Derek's explicit sign-off.
- KPIs updated as the business scales past initial milestones.

---

## Layer 3: SOUL

**File:** `system/SOUL.md`
**Format:** Structured markdown with tables and examples

### Purpose

Defines Zo's personality and communication patterns to maintain a consistent voice. Ensures Zo sounds like a co-founder texting from the trenches, not a corporate assistant.

### Key Sections (extracted from actual headings)

| Section | Description |
|---------|-------------|
| **Core Personality** | 5 traits: Street-smart operator at 2am, Confident energy, Speed-obsessed, Speaks like Derek, Playful but serious |
| **Communication Style** | DO rules (short/punchy, bold for emphasis, conclusion first, co-founder voice) and NEVER rules (no "Certainly", no corporate jargon, no hedging, no decorative emoji) |
| **Response Framing** | 5 situational frames: Executing, Reporting, Blocked, Something breaks, Something wins |
| **Example Responses** | Good vs. Bad response pairs demonstrating correct voice and anti-patterns |
| **Tacit Knowledge Triggers** | 8 Derek-phrase-to-action mappings (e.g., "Let's go." = green light, "Build it." = start with end deliverable) |

### Update Protocol

- Rarely updated; personality is foundational.
- New tacit triggers added as Derek establishes new shorthand.
- Communication rules adjusted only if voice consistently misses the mark.

---

## Boot Load Order

The BOOTSTRAP script defines a strict 5-step load order executed at session start:

```
Step 1: Read MEMORY.md           --> Long-term facts (business state, identity, hard rules, operating principles)
Step 2: Read daily/YYYY-MM-DD.md --> Today's session context (what happened so far)
Step 3: Read leads/clients CRM   --> Pipeline state (leads/crm.csv, clients/active.csv, leads/inbound.csv)
Step 4: Check yesterday's note   --> Pending actions (PENDING/TODO items from prior session)
Step 5: Start the conversation   --> Zo is fully oriented and ready to operate
```

If Layer 1 (MEMORY.md) is missing, the boot sequence flags it as critical: "MISSING -- run setup first". Layer 2 (daily note) gracefully handles empty state ("will create"). Layer 3 (pipeline) reports counts when available.

---

## Update Matrix

| Layer | File | Updated By | Frequency | Trigger |
|-------|------|-----------|-----------|---------|
| BOOTSTRAP | `system/BOOTSTRAP.md` | Derek (manual) | Rare | New data sources, boot logic changes, new integrations |
| IDENTITY | `system/IDENTITY.md` | Derek + Zo (collaborative) | Infrequent | Role expansion, new guardrails, KPI milestones reached |
| SOUL | `system/SOUL.md` | Derek (manual) | Rare | Voice drift detected, new tacit triggers established |

---

## Cross-Layer Dependencies

```
BOOTSTRAP ──loads──> IDENTITY context via MEMORY.md
BOOTSTRAP ──loads──> SOUL context via MEMORY.md
BOOTSTRAP ──loads──> Pipeline state (leads, clients, daily notes)

IDENTITY ──defines──> What Zo does (operational scope)
SOUL ──defines──> How Zo communicates (voice + framing)

IDENTITY.guardrails ──constrains──> SOUL.response_framing
  (e.g., SOUL says "fix first, explain second" but IDENTITY says "don't touch money without asking")

SOUL.tacit_triggers ──references──> IDENTITY.responsibilities
  (e.g., "Build it." trigger assumes Zo knows what he owns from IDENTITY)
```

**Dependency Chain:**
- BOOTSTRAP must load first -- it orchestrates everything else.
- IDENTITY must be internalized before SOUL -- you need to know *what* you do before defining *how* you sound doing it.
- SOUL depends on IDENTITY context -- response framing references responsibilities and guardrails.
- All three layers converge at session start to produce a fully oriented Zo.

---

*End of catalog. Source files: `system/BOOTSTRAP.md` (3041 bytes), `system/IDENTITY.md` (2106 bytes), `system/SOUL.md` (2703 bytes).*
