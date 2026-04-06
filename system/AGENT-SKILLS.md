# AGENT-SKILLS.md — Ghost Engine Agent Capabilities

Ghost Engine runs 7 autonomous agents that power Zo AI's end-to-end creator monetization pipeline. This document details the complete skill sets, scoring logic, and operational rules for two core agents: **Lead Hunter** and **Closer Engine**. Together they handle everything from prospect discovery and qualification through objection handling and close execution.

---

## Lead Hunter Agent

- **Schedule:** Daily @ 7:30 AM UTC
- **Role:** Scrapes TikTok, YouTube, and LinkedIn for creators with 10K–100K followers. Scores them on monetization gaps, engagement quality, and fit with Ghost Engine's ideal client profile.

---

### Scoring System

Six weighted factors produce a raw score with a maximum of 140 points, normalized to a 0–100 scale.

| Factor | Max Points | Weight | Description |
|---|---|---|---|
| Followers / Audience Size | 40 | 28.6% | Total followers across platforms |
| Niche Match | 30 | 21.4% | Alignment with target niches (coaching, fitness, finance, SaaS, e-commerce, education) |
| Email Availability | 15 | 10.7% | Verified email address is present and deliverable |
| Profile Completeness | 15 | 10.7% | Bio, links, profile photo, location, and industry fields populated |
| Content Signals | 30 | 21.4% | Engagement rate, posting frequency, content quality indicators |
| Activity Recency | 10 | 7.1% | How recently the lead published new content |

**Normalization formula:**

```
normalized_score = (raw_score / 140) * 100
```

---

### Follower Breakdown

Points awarded for the **Followers / Audience Size** factor based on total cross-platform follower count:

| Follower Range | Points |
|---|---|
| 100K+ | 40 |
| 50K✓99K | 32 |
| 25K–49K | 24 |
| 10K–24K | 16 |
| 5K–9K | 10 |
| 1K-4K | 5 |
| < 1K | 0 |

---

### Score Tiers

| Tier | Score Range | Action | SLA |
|---|---|---|---|
| **Hot** | 80–100 | Immediate outreach, route to Closer Engine, book discovery call within 24 hrs | < 2 hours |
| **Warm** | 60–79 | Nurture sequence — personalized DM + email drip campaign | < 24 hours |
| **Cold** | 40–59 | Long-term nurture — weekly content touchpoints and value adds | < 72 hours |
| **Dead** | < 40 | Archive — no active outreach unless re-engagement signal detected | N/A |

---

### Platform-Specific Modifiers

Modifiers are applied on top of the base score after initial calculation.

**LinkedIn**

| Condition | Modifier |
|---|---|
| Services section enabled or Creator Mode active | +5 |
| 500+ connections | +3 |
| No profile photo or generic headline | -5 |

**TikTok**

| Condition | Modifier |
|---|---|
| Verified badge | +5 |
| Link in bio present | +3 |
| No posts in the last 30 days | -5 |

**YouTube**

| Condition | Modifier |
|---|---|
| Monetization enabled | +5 |
| Consistent upload schedule | +3 |
| Fewer than 10 videos total | -5 |

---

### Disqualification Criteria

Any of the following conditions immediately set `score = 0` and `tier = Dead`:

1. **Fake / bot account** — Abnormal follower-to-engagement ratio or known bot signatures
2. **Competitor** — Operates in the same service space as Ghost Engine
3. **Blacklisted domain** — Email domain appears on the internal blacklist
4. **Inactive > 6 months** — No content published across any platform in the last 180 days
5. **Previous opt-out** — Lead has previously unsubscribed or requested no contact
6. **Inappropriate content** — Profile contains content that violates brand safety guidelines
7. **Duplicate** — Lead already exists in the pipeline under a different record

---

### Score Decay Rules

Lead scores decay automatically based on time since last engagement or activity:

| Days Since Last Activity | Point Decay |
|---|---|
| 7 days | -2 pts |
| 14 days | -5 pts |
| 30 days | -10 pts |
| 60 days | -20 pts |
| 90 days | -30 pts |

**Decay rules:**

- Minimum score floor is **0** — scores cannot go negative.
- Any new engagement (reply, click, page visit, form fill) **resets the decay timer**.
- A **Hot** lead that decays below 60 is automatically moved to **Warm**.
- A **Warm** lead that decays below 40 is automatically moved to **Cold**.
- Decay job runs **daily at midnight UTC**.

---

### Re-Scoring Triggers

The following events trigger an immediate re-calculation of a lead's score:

1. **New engagement data** — Reply, click, page visit, or social interaction detected
2. **Follower count change > 10%** — Significant audience growth or decline since last score
3. **Form or call completion** — Lead fills out a form or completes a discovery call
4. **Manual override** — Operator manually flags a lead for re-evaluation
5. **Weekly batch re-score** — Automatic full re-score every **Sunday at 2:00 AM UTC**

---

## Closer Engine Agent

- **Schedule:** Daily @ 9:00 AM UTC
- **Role:** Works hot leads through DM and email sequences, handles objections in real time, books discovery calls, and pushes qualified prospects toward close.

---

### Close Tiers

Three tiers aligned with Ghost Engine's core offers:

| Tier | Price | Timeline | Deliverables |
|---|---|---|---|
| **Quick Flip** | $990 | 48 hours | Monetization audit + backend blueprint + one quick-win system |
| **Full Engine** | $4,970 | 14 days | Complete monetization backend — offers, funnels, email sequences, payment integration |
| **Ghost Partner** | $9,700 + 15% rev share | 90 days | Full deployment + ongoing optimization + revenue share partnership |

---

### Hot Signal Detection

Six signals that indicate a lead is ready for immediate close action:

1. **High lead score** — Score of 80+ from Lead Hunter
2. **Booking request** — Lead attempts to schedule a call or demo
3. **Payment page visit** — Lead lands on Stripe checkout or pricing page
4. **Rapid reply cadence** — Lead responds to messages within minutes consistently
5. **Pricing question in DM** — Lead asks about cost, packages, or payment options
6. **Multiple page views in session** — Lead views 3+ pages in a single browsing session

**Trigger threshold:** 2 or more signals detected **OR** lead score of 80+.

---

### Speed-Close Trigger System

When hot signals cross the threshold, the following sequence fires automatically:

1. **Immediately route to Closer Engine** — Lead is pulled from nurture and assigned to active close queue.
2. **Select optimal close pattern** — System evaluates context and selects the best fit from the 7 Close Patterns (see below).
3. **Send personalized close message** — Tailored DM or email crafted from lead data, engagement history, and detected signals.
4. **Alert operator via SMS** — Real-time notification sent to the operator with lead summary, signal details, and recommended action.

---

### 3-Stage Stripe Abandonment Recovery

Triggers when a lead initiates Stripe checkout but does not complete payment.

| Stage | Timing | Approach | Description |
|---|---|---|---|
| **Stage 1** | Within 5 minutes | Soft nudge | Friendly check-in acknowledging the visit — "Noticed you were checking things out, happy to answer any questions." |
| **Stage 2** | 12 hours | Value reframe | Re-articulates the core value proposition and ROI, reframes the offer around the lead's specific pain points. |
| **Stage 3** | 24 hours | Scarcity / deadline close | Introduces urgency — limited slots, bonus expiration, or price lock deadline. |

Each stage escalates urgency and adapts messaging based on prior engagement, reply history, and which offer tier the lead was viewing.

---

### 48-Hour Near-Close Recovery

Detects leads that have stalled for 48+ hours while near the close threshold.

**Stall reason classification (4 categories):**

| Stall Reason | Description | Recovery Approach |
|---|---|---|
| **"Not now"** | Lead expresses interest but delays timing | Future-pace the value; schedule a follow-up with a concrete date |
| **"Send info"** | Lead requests more details instead of committing | Deliver a concise case study or results snapshot, then re-engage with a direct ask |
| **"Too expensive"** | Lead raises price objection | Reframe around ROI and cost-of-inaction; offer Quick Flip as an entry point |
| **"Need to think"** | Lead is deliberating without clear objection | Provide social proof (testimonials, results), set a soft deadline to create decision momentum |

The system dispatches objection-specific recovery messages tailored to the classified stall reason and the lead's engagement history.

---

### 7 Close Patterns

The Closer Engine selects from seven proven close patterns based on lead context, engagement signals, and conversation history.

#### 1. Direct Ask Close

- **When:** Lead has shown strong buying signals, no unresolved objections.
- **How:** Straightforward call to action — "Ready to get started? Here's your link."
- **Best for:** Hot leads with rapid reply cadence and pricing page visits.

#### 2. Assumptive Close

- **When:** Conversation has progressed naturally toward commitment.
- **How:** Proceed as if the decision is made — "I'll get your onboarding started. Which email should I send the intake form to?"
- **Best for:** Leads who have already discussed deliverables and timelines.

#### 3. Scarcity Close

- **When:** Lead is interested but not moving to action.
- **How:** Introduce genuine scarcity — limited spots, cohort deadlines, or bonus expiration.
- **Best for:** Warm-to-hot leads who need a reason to act now rather than later.

#### 4. ROI Close

- **When:** Lead has expressed price sensitivity or cost concerns.
- **How:** Reframe the investment against expected returns — "Most creators recoup the $990 in the first 2 weeks from the quick-win system alone."
- **Best for:** Leads stalled on "too expensive" or comparing alternatives.

#### 5. Social Proof Close

- **When:** Lead is deliberating and needs external validation.
- **How:** Share specific case studies, testimonials, or results from similar creators.
- **Best for:** "Need to think" stalls and leads who are risk-averse.

#### 6. Downsell Close

- **When:** Lead wants to move forward but the current tier is beyond their budget.
- **How:** Offer a lower tier as an entry point — "Start with Quick Flip at $990 and upgrade to Full Engine once you see results."
- **Best for:** Leads interested in Full Engine or Ghost Partner who hit a budget wall.

#### 7. Deadline Close

- **When:** Lead has been in the pipeline for an extended period without converting.
- **How:** Set a concrete deadline for the current offer or bonus — "This pricing locks in through Friday. After that, the investment increases."
- **Best for:** Long-nurture leads who need a forcing function to make a decision.

---

### Momentum States

The Closer Engine tracks each lead's momentum state to determine pacing, message tone, and escalation strategy.

| State | Definition | Agent Behavior |
|---|---|---|
| **Accelerating** | Lead engagement is increasing — faster replies, more page views, forward-leaning language | Increase message frequency, move toward direct close patterns, prioritize in queue |
| **Steady** | Lead is engaged but not accelerating — consistent replies at a normal pace | Maintain current cadence, continue value delivery, watch for signal changes |
| **Stalling** | Lead engagement is declining — slower replies, shorter messages, fewer interactions | Trigger near-close recovery, switch to value-reframe messaging, classify stall reason |
| **Gone Dark** | Lead has stopped responding entirely for 48+ hours | Enter re-engagement sequence — 3 touchpoints over 7 days, then archive if no response |

**State transitions are evaluated after every interaction.** The system compares current engagement velocity against the lead's historical baseline to determine direction.

---

*Document generated for Ghost Engine — Zo AI autonomous agent system.*
*Last updated: 2026-04-06*
