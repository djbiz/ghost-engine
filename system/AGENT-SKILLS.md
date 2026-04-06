# AGENT-SKILLS -- Ghost Engine

## Lead Hunter Agent

**Schedule:** Daily at 7:30 AM | **Sources:** TikTok, YouTube, LinkedIn (10K-100K followers)

### Scoring (140 pts raw, normalized 0-100)

| Factor | Max | Weight |
|---|---|---|
| Followers / Audience Size | 40 | 28.6% |
| Niche Match | 30 | 21.4% |
| Content Signals | 30 | 21.4% |
| Email Availability | 15 | 10.7% |
| Profile Completeness | 15 | 10.7% |
| Activity Recency | 10 | 7.1% |

### Tiers

| Tier | Range | SLA |
|---|---|---|
| Hot | 80-100 | < 2 hours |
| Warm | 60-79 | < 24 hours |
| Cold | 40-59 | < 72 hours |
| Dead | < 40 | N/A |

### Disqualification

Fake/bot, competitor, blacklisted domain, inactive > 6 months, previous opt-out, inappropriate content, or duplicate.

### Decay

7d = -2, 14d = -5, 30d = -10, 60d = -20, 90d = -30. Min score: 0. Reset on engagement. Cron: midnight UTC daily. Full re-score: Sundays 2 AM UTC.

### Output

`leads/active.csv`: name, platform, handle, followers, email, niche, raw_score, normalized_score, tier, scraped_at, decay_applied.

---

## Closer Engine Agent

**Trigger:** Hot leads immediately; Warm leads after nurture engagement
**Channels:** LinkedIn DM, TikTok DM, Email, Discovery Call

### Outreach (Days 0-14)

| Day | Action | Channel |
|---|---|---|
| 0 | Initial DM + email | DM + Email |
| 2 | Problem deep dive | Email |
| 3 | Engage their content | Platform |
| 5 | Case study / proof | Email |
| 7 | Follow-up DM | DM |
| 9 | Offer framework | Email |
| 14 | Soft close | Email |

### Call Booking

30-min discovery call, Mon-Fri 10 AM-4 PM EST. No-show: reschedule within 1 hour.

### Discovery Call Script

1. Opener (2 min) -- rapport
2. Situation (5 min) -- current monetization
3. Problem (5 min) -- attention vs revenue gap
4. Implication (5 min) -- cost of inaction
5. Solution (8 min) -- Ghost Engine offer
6. Close (5 min) -- objections, pricing, next steps

### Offers

| Offer | Price | Timeline |
|---|---|---|
| Quick Flip | $990 | 48 hours |
| Full Engine Install | $4,970 | 10-14 days |
| Custom Scope | Quote | TBD |

### Pipeline Stages

New Lead > Contacted > Engaged > Call Booked > Call Completed > Proposal Sent > Won / Lost

### KPIs

| Metric | Target |
|---|---|
| DM response rate | > 15% |
| Call booking rate | > 25% |
| Call show rate | > 80% |
| Close rate | > 20% |
| Avg deal value | > $2,500 |
| Time to close | < 14 days |
| Monthly revenue | > $25,000 |
