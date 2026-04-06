# AGENT-SKILLS.md -- Ghost Engine

## Overview

Two primary agents power Ghost Engine: **Lead Hunter** finds high-potential creators with attention but no backend revenue; **Closer Engine** converts those leads into paying clients. Both run under operator AI "Zo" with unified CRM and three-layer memory.

---

## Lead Hunter Agent

- **Schedule:** Daily at 7:30 AM
- **Sources:** TikTok, YouTube, LinkedIn (10K-100K followers)
- **Target:** Creators with audience but no courses, funnels, or email monetization

### Scoring (140 pts raw, normalized 0-100)

| Factor | Max | Weight | Details |
|---|---|---|---|
| Followers | 40 | 28.6% | 100K+=40, 50-99K=32, 25-49K=24, 10-24K=16, 5-9K=10, 1-4K=5 |
| Niche Match | 30 | 21.4% | Full=30, partial=15. Niches: coaching, consulting, SaaS, agency, e-commerce, fitness, finance, crypto |
| Email | 15 | 10.7% | Verified=15, Unverified=8, None=0 |
| Profile | 15 | 10.7% | Photo=3, Bio=3, Website=3, Location=3, Industry=3 |
| Content | 30 | 21.4% | Engagement >5%=15, 2-5%=10. Frequency 3+/wk=10. Video=5 |
| Recency | 10 | 7.1% | 7d=10, 30d=6, 90d=3 |

### Tiers: Hot (80-100, <2hr SLA) | Warm (60-79, <24hr) | Cold (40-59, <72hr) | Dead (<40, archive)

### Platform Modifiers
- LinkedIn: +5 Creator Mode, +3 500+ connections, -5 no photo
- TikTok: +5 1M+ likes, +3 avg views >10K, -5 <50 videos
- YouTube: +5 monetized, +3 avg >5K views, -5 <20 videos

### Rules
- Disqualify: existing course/funnel, <1K followers, 90d inactive, duplicate, competitor
- Decay: -5 pts/week no signal, drop tier after 2 weeks, auto-archive <20

---

## Closer Engine Agent

- **Trigger:** Hot tier (80+) or manual escalation
- **Channels:** Email, DM (Instagram, LinkedIn, TikTok), SMS

### 14-Day Outreach Sequence

| Day | Channel | Action |
|---|---|---|
| 0 | DM | Personalized intro, no pitch |
| 1 | Email | Value-first with case study |
| 3 | DM | Engage on recent post |
| 5 | Email | CTA -- free strategy session |
| 7 | DM | Social proof / testimonial |
| 10 | Email | Urgency -- limited spots |
| 14 | DM | Final follow-up, open door |

### Call Booking
- Calendly/Cal.com, Mon-Fri 9-5 (auto-timezone), 24h+1h reminders, 15min no-show reschedule

### SPIN Discovery Script
1. Situation: current strategy  2. Problem: audience-to-revenue gap  3. Implication: cost of inaction  4. Need-Payoff: $10K-$50K/mo system

### Offers: Starter $2,500 | Growth $5,000 | Scale $10,000+

### Pipeline: New Lead > Contacted > Engaged > Call Booked > Call Complete > Proposal Sent > Closed Won/Lost

### Objection Handling
- "Too expensive" -> ROI reframe  - "Need to think" -> specificity question  - "DIY" -> timeline compression  - "Bad timing" -> future follow-up  - "Been burned" -> guarantee/case study

### KPIs: >15% reply rate, >30% reply-to-call, >25% close rate, $5K+ avg deal, <14d close, $50K+/mo target

---

## Shared Infrastructure

### Three-Layer Memory
1. **STM:** Session context, cleared per run
2. **LTM:** All profiles, history, outcomes in CRM + vector DB
3. **Episodic:** Winning templates and sequences, learned from past

### Unified CRM
- Single source (Airtable/HubSpot), real-time scores, auto-advance stages, daily digest at 8 PM

### Operator AI -- Zo
- Orchestrates agents, escalates >$10K deals, overrides scores/sequences, weekly performance reviews

---

## Changelog

| Date | Change |
|---|---|
| 2026-04-06 | Comprehensive documentation -- Lead Hunter scoring, Closer Engine sequences, shared infrastructure |
