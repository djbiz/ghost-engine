# Ghost Monetization Engine — Ops

## THE FELIX DIFFERENCE

Felix (Nat Eliason's bot) got $14K in 3 weeks by running a business that gets smarter every session. Zo runs Ghost Engine the same way.

**Felix's 3-layer memory → Zo's 5-file memory system:**
1. MEMORY.md — State, goals, progress
2. USER.md — Derek's profile, voice, rules
3. SOUL.md — Zo's personality + operating style
4. decision-rules.md — If/then/this logic
5. daily/{{date}}.md — Daily context + learnings

**Joel (Simon Hørup's bot) → Zo's slog tradition:**
Every action logged with timestamp, decision, outcome, revenue. Pattern recognition across 100+ actions.

**Felix's weekly evolution → Zo's Sunday evolution:**
Every Sunday 8 PM: what worked, what didn't, what to double down on, what to kill.

---

## Active Agents

| Agent | Schedule | Job |
|-------|----------|-----|
| 🧲 Lead Hunter | 7:30 AM | Apollo lead finding + CRM scoring |
| ⚔️ Closer | 9 AM | Close rate engine + reply scoring |
| 🏗️ Fulfillment | 11 AM | Delivery tracking + proof loop |
| 🌙 Nightly Consolidator | 11 PM | Memory update + pattern learning |
| 🔄 Sunday Evolution | 8 PM (Sun) | Weekly + monthly strategy |
| **LinkedIn Daily** | **9 AM** | **Engagement + content posting** |
| LinkedIn Outreach | 9 AM (Apr 11+) | DM campaigns to scored network |

---

## LinkedIn — Sandbox Phase

**Account:** Derek Jamieson — linkedin.com/in/derek-jamieson-8646a03ba/
**DM Unlock:** April 11, 2026 (13 days from launch)
**Current Mode:** SANDBOX — likes, comments, connections only

**Engagement Daily:**
- Like 5+ posts in niche (creators, monetization, TikTok, YouTube, digital products)
- Comment on 2-3 with first-person insight statements
- Log every action in leads/linkedin-engagement.log

**Content Posting Schedule:**
- April 5: Post 1 — The Monetization Gap
- April 7: Post 2 — The Attention Myth
- April 9: Post 3 — The 48-Hour Flip
- April 11: Post 4 + LAUNCH DAY DMS FIRE

**LinkedIn Pre-Scorer:** Run twice weekly
```bash
cd /home/workspace/Ghost-Monitization-Engine
node scripts/linkedin-scorer.js score '<json_profile>'
```

---

## Active Routes (zo.space)

| Route | Type | Purpose |
|-------|------|---------|
| /ghost-engine | Page (public) | Main landing page |
| /ghost-engine/book | Page (public) | Calendly discovery call booking |
| /ghost-engine/pricing | Page (public) | 3-tier pricing |
| /ghost-engine/dashboard | Page (private) | Client/lead dashboard |
| /api/lead-capture | API | Inbound lead capture → GetResponse |
| /api/book-call | API | Discovery call requests |
| /api/ghost-stats | API | Dashboard data |

---

## Stripe Products

| Product | Price | Payment Link |
|---------|-------|--------------|
| Quick Flip | $990 | https://buy.stripe.com/00w9AVadm1BH0664xCbQY03 |
| Full Engine | $4,970 | https://buy.stripe.com/3cI28t4T26W12ee7JObQY04 |
| Ghost Partner | $9,700 | https://buy.stripe.com/00w8AVadm1BHQ1GQ5RXcSS6FK |

---

## Workspace Structure

```
Ghost-Monitization-Engine/
├── leads/
│   ├── crm.csv              # All leads with scores
│   ├── inbound.csv          # Inbound leads from landing page
│   ├── discovery-calls.csv  # Call bookings
│   ├── linkedin-engagement.log  # LinkedIn engagement history
│   └── linkedin-scored.csv  # Pre-scored LinkedIn network
├── clients/
│   ├── active.csv
│   └── archived.csv
├── offers/
│   ├── quick-flip-template.md
│   └── full-engine-install-template.md
├── funnels/
├── scripts/
│   ├── outreach-engine.js       # Apollo + email pipeline
│   ├── crm.js                  # CLI CRM tool
│   ├── dm-templates.js          # DM templates
│   ├── close-rate-engine.js     # Revenue mirror + close scripts
│   ├── proof-loop-engine.js     # Case study builder
│   ├── speed-to-proof.js        # First-client accelerator
│   ├── linkedin-scorer.js       # LinkedIn pre-scorer
│   ├── linkedin-daily-engagement.js  # Daily engagement tracker
│   ├── command-layer.js         # DOUBLE DOWN | KILL | TEST
│   └── kpi-dashboard.js        # Live metrics
├── assets/
│   ├── content-bank.md         # 5 posts ready for launch
│   ├── ad-creatives.md         # 3 ad angles
│   └── system-prep.md          # 14-day sandbox plan
├── system/
│   ├── BOOTSTRAP.js            # Memory loader
│   ├── MEMORY.md               # Zo's memory
│   ├── SOUL.md                 # Zo's personality
│   ├── USER.md                 # Derek's profile
│   ├── HEARTBEAT.md            # System pulse
│   └── decision-rules.md        # If/then logic
├── daily/
│   └── TEMPLATE.md             # Daily note template
├── commands/
│   └── COMMAND-LAYER.md        # Derek's command interface
├── phases.md                   # 30-day execution phases
└── 100K-PLAN.md               # $100K/month execution plan
```

---

## The 3 Commands Derek Uses Daily

**"DOUBLE DOWN"** — What's working?
```
node /home/workspace/Ghost-Monitization-Engine/scripts/command-layer.js double-down
```

**"KILL [X]"** — What's not working?
```
node /home/workspace/Ghost-Monitization-Engine/scripts/command-layer.js kill <item>
```

**"TEST [X]"** — What's the next experiment?
```
node /home/workspace/Ghost-Monitization-Engine/scripts/command-layer.js test <experiment>
```

---

## Pipeline

**Stage 1 (Pre-April 11):**
- Lead scoring in Apollo/CRM
- LinkedIn engagement + content
- Content bank + DM templates finalized

**Stage 2 (April 11+):**
- LinkedIn DMs to scored network
- Email sequences to Apollo leads
- Discovery calls booked
- Quick Flip closings

**Stage 3 (Proof Stacking):**
- Case studies built from first wins
- Content loop: wins → posts → more DMs
- Ascension: Quick Flip → Full Engine → Ghost Partner

---

## The Money Math

| Tier | Price | Close Rate | Monthly Target |
|------|-------|-----------|----------------|
| Quick Flip | $990 | 20% | 10 closes = $9.9K |
| Full Engine | $4,970 | 15% | 4 closes = $19.8K |
| Ghost Partner | $9,700 | 10% | 2 closes = $19.4K |
| **Total** | | | **$49.1K/mo** |

---

## Next Actions

- [ ] Derek posts first Ghost Engine content (April 5)
- [ ] Apollo leads scored and tagged
- [ ] DM templates reviewed and finalized
- [ ] April 11: FIRST DM BATCH FIRES
- [ ] April 18: First case study built

---

*Last updated: 2026-03-28*
