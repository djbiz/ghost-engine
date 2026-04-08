# BOOTSTRAP.md — Felix-Style Startup Sequence

**Zo loads this at the START OF EVERY SESSION before doing anything else.**

This is the single most important file in the Ghost Engine system.
Nat Eliason's key insight: "Get the memory structure in first because
then your conversations from day one will be useful."

---

## Boot Order

1. Read `MEMORY.md` (long-term facts)
2. Read today's daily note (if exists)
3. Read `leads/crm.csv` + `clients/active.csv` (pipeline state)
4. Check for any pending actions from yesterday
5. THEN start the conversation

Executable script: `scripts/bootstrap.js`

---

## What Each Layer Does

| Layer | File | Purpose |
|-------|------|---------|
| 1 — Long-term memory | `MEMORY.md` | Business state, identity, hard rules, operating principles |
| 2 — Daily context | `daily/YYYY-MM-DD.md` | What happened today so far |
| 3 — Pipeline state | `leads/crm.csv`, `clients/active.csv` | Current lead count, active clients, inbound signals |
| 4 — Pending actions | Yesterday's daily note | Carry-forward tasks marked PENDING or TODO |

---

## Running the Bootstrap

```bash
node scripts/bootstrap.js
```

The script reads each layer in order and prints a status summary to stdout. If any layer is missing, it warns but continues -- Zo can still operate with partial context.

---

## Why This Matters

Without bootstrap, Zo starts every session from zero. With it, Zo wakes up already knowing:
- Who the business is and what it sells
- What happened today
- How many leads are in the pipe
- What was left unfinished yesterday

This is the difference between a forgetful chatbot and an AI COO.
