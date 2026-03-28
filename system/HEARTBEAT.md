# HEARTBEAT.md — Ghost Engine's Pulsing System

**Zo is alive between sessions. The heartbeat keeps the system breathing.**

---

## THE 4 BEATS (Daily)

| Time | Beat | Agent | Purpose |
|------|------|-------|---------|
| 7:30 AM | 🫀 Wake Up | Lead Hunter | Find leads, fire outreach, fill funnel |
| 9:00 AM | ⚔️ Pulse | Closer | Check money, prep calls, push pipeline |
| 11:00 AM | 🏗️ Build | Fulfillment | Deliver, content, proof loops |
| 11:00 PM | 🌙 Consolidate | Nightly | Learn, update memory, prep tomorrow |

---

## AUTOMATIC TRIGGERS (Event-Based)

These fire instantly — no waiting for the next beat:

| Event | Trigger | Response |
|-------|---------|----------|
| New lead inbound | `leads/inbound.csv` updated | Send first DM within 4h (Rule 5) |
| Discovery call booked | `leads/discovery-calls.csv` updated | SMS Derek immediately (Rule 6) |
| Stripe payment | Stripe webhook fires | Proof loop + SMS + case study (Rule 17) |
| Stripe click, no purchase | Speed close check | Urgency DM within 2h (Rule 8) |
| Lead ghosts 48h | Near-close check | Re-engage DM (Rule 13) |
| DM response received | Outreach reply logged | Save to high-performers (Rule 18) |

---

## HEARTBEAT LOGIC (For Automation Scripts)

Every automation script references this:

```javascript
const HEARTBEAT = {
  // Check every 4 hours for ghosted leads
  GHOST_CHECK_INTERVAL: 4 * 60 * 60 * 1000,
  // Re-engage after 48h silence
  REENGAGE_WINDOW: 48 * 60 * 60 * 1000,
  // Speed close window (post-Stripe-click)
  SPEED_CLOSE_WINDOW: 2 * 60 * 60 * 1000,
  // First touch SLA (new lead → first DM)
  FIRST_TOUCH_SLA: 4 * 60 * 60 * 1000,
  // Call prep buffer (before call)
  CALL_PREP_BUFFER: 2 * 60 * 60 * 1000,
};
```

---

## DECISION RULES (Always Active)

Zo follows `decision-rules.md` before every action. The rules are:

- **Score >= 80 + no offer** → Quick Flip push
- **Score >= 70 + has offer** → Full Engine push
- **Score >= 90 + proven revenue** → Ghost Partner flag (Derek only)
- **Score < 50** → Nurture only, no push
- **Lead mentions price** → Match response to tier
- **Lead ghosts 48h** → Re-engage DM
- **New payment** → Proof loop immediately
- **Close rate < 20% for 2 weeks** → Audit + fix
- **DM response < 5%** → Rotate templates

---

## WHAT HAPPENS WHEN ZO "WAKES UP"

Every agent run follows this sequence:

```
1. Read zo-identity.md     ← Who I am, what I do
2. Read decision-rules.md  ← What to do in every situation
3. Read MEMORY.md          ← Current state of the business
4. Read HEARTBEAT.md       ← What needs to happen now
5. Check today's daily note ← What's happening today
6. Execute my mission       ← The beat's specific job
7. Log to slog.jsonl       ← Record what I did
8. Text Derek if needed    ← Urgent only
```

This is the boot sequence. Always. Every time.

---

## WHEN SOMETHING BREAKS

If an automation script fails:
1. Log the error to `lessons-learned.md`
2. Attempt a fix (most common issues are known)
3. If fixed → continue
4. If not fixed → SMS Derek with the error
5. Move to next task (don't get stuck)

---

## THE HEARTBEAT IS THE DIFFERENCE

Felix (OpenClaw) relies on Nat to check in.

Ghost Engine Zo runs on pure signal. The heartbeat means Zo doesn't need Derek to tell it what to do — the system tells Zo what to do. Every 7:30, 9:00, 11:00, 11:00 PM.

Derek's only job: close the deals Zo sends him.
