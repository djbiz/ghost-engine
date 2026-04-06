# AGENT-SKILLS.md — Ghost Engine

> Operational reference for Lead Hunter and Closer Engine agents.

## Lead Hunter Agent

### Overview
Scrapes TikTok, YouTube, LinkedIn for 10K-100K follower creators with monetization gaps. Scheduled nightly 2AM UTC via lead-hunter-cron.js.

### Weighted Scoring Model

| Factor | Max Points | Weight |
|---|---|---|
| Followers | 40 | 28.6% |
| Niche Match | 30 | 21.4% |
| Email Availability | 15 | 10.7% |
| Profile Completeness | 15 | 10.7% |
| Content Signals | 30 | 21.4% |
| Recency | 10 | 7.1% |

Total: 140 raw normalized 0-100

### Follower Ranges

| Range | Points |
|---|---|
| 100K+ | 40 |
| 50-99K | 32 |
| 25-49K | 24 |
| 10-24K | 16 |
| 5-9K | 10 |
| 1-4K | 5 |
| <1K | 0 |

### Niche Keywords
Primary: coaching, consulting, course creator, digital products, SaaS, agency, freelancer
Secondary: mindset, motivation, productivity
Full=30 Partial=15 None=0

### Email Availability
Verified=15 Unverified=8 None=0

### Profile Completeness
Photo(3)+Bio(3)+Website(3)+Location(3)+Industry(3)=15

### Content Signals
Engagement: >5%=15, 2-5%=10, <2%=3
Frequency: 3+/wk=10, 1-2/wk=5, <weekly=0
Type: Video=5, Text=2

### Activity Recency
7d=10, 30d=6, 90d=3, >90d=0

### Platform Modifiers
LinkedIn: +5 Open to Services, +3 500+ connections, -5 no photo
TikTok: +5 verified, +3 link in bio, -5 no posts 30d
YouTube: +5 monetization, +3 consistent uploads, -5 <10 videos

### Disqualification Criteria
1. Fake/bot 2. Competitor 3. Blacklisted domain 4. Inactive >6mo 5. Previous opt-out 6. Inappropriate content 7. Duplicate in CRM
Any match: score=0, tier=Dead

### Score Decay
| Days | Penalty |
|---|---|
| 7 | -2 |
| 14 | -5 |
| 30 | -10 |
| 60 | -20 |
| 90 | -30 |
Min 0. Hot<60->Warm. Warm<40->Cold. Daily midnight UTC.

### Re-scoring Triggers
New engagement, follower >10% change, form/call done, manual override, weekly Sunday 2AM UTC

### Tier Assignment
| Tier | Score | SLA |
|---|---|---|
| Hot | 80-100 | <2hr |
| Warm | 60-79 | <24hr |
| Cold | 40-59 | <72hr |
| Dead | <40 | Archive |

---

## Closer Engine Agent

### Overview
Works hot leads via DM/email. Handles objections, recommends pricing, books calls. Daily 9AM UTC.

### Close Tiers
| Tier | Price | Timeline | Includes |
|---|---|---|---|
| Quick Flip | $990 | 48hrs | Monetization audit+blueprint+quick-win |
| Full Engine | $4970 | 14 days | Complete backend+funnel+automation |
| Ghost Partner | $9700+15% rev share | 90 days | Full deployment+optimization+support |

### Hot Signals
1. Multiple page views 2. Pricing page revisits 3. Proposal link clicks 4. Rapid reply cadence 5. Direct pricing questions 6. Lead score 80+
Trigger: 2+ signals OR score 80+

### Speed-Close Trigger
1. Flag hot in CRM 2. SMS via automation-hot-lead-alert.js 3. Auto-select tier 4. Recommend pattern via close-rate-engine.js 5. Dispatch outreach <15min

### Stripe Abandonment
| Stage | Timing | Action |
|---|---|---|
| 1 | Immediate | Soft nudge |
| 2 | 12hr | Value reframe+testimonial |
| 3 | 24hr | Scarcity/deadline close |

### 48hr Near-Close Recovery
Detects leads stalled 48+hrs. automation-nearclose-recovery.js
| Objection | Strategy |
|---|---|
| Not now | Timing reframe |
| Send info | Value consolidation |
| Too expensive | ROI+payment terms |
| Need to think | Social proof injection |

### Close Patterns
| Pattern | Description |
|---|---|
| Revenue Mirror | Reflect revenue goal as justification |
| Money Gap | Quantify cost of inaction over 90d |
| Binary Close | Force yes/no decision |
| Payment Close | Anchor on payment terms not total |
| Objection Handler A | First reframe using lead words |
| Objection Handler B | Second reframe with external proof |
| Deal Stacker | Stack value to overwhelm price |
close-rate-engine.js recommends optimal pattern based on lead profile and historical close data.