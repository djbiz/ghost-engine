# Scripts Directory — Ghost Engine

> 28 JavaScript automation scripts powering the Ghost Engine monetization pipeline.

Generated: 2026-04-05 | Total Scripts: 28 | Combined Size: ~128,879 bytes

---

## 1. Lead Acquisition

Scripts that identify, score, and initiate contact with high-value prospects through Apollo and LinkedIn integrations.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `apollo-search-workflow.js` | 3,732 B | Apollo CLI search across 4 market segments with dedup | `runSegmentSearch`, `deduplicateResults`, `exportLeads` |
| `linkedin-scorer.js` | 5,822 B | Weighted lead scoring engine (0–100 scale) | `calculateScore`, `applyWeights`, `rankLeads` |
| `linkedin-outreach.js` | 4,297 B | LinkedIn connection requests + automated DM sequences | `sendConnectionRequest`, `scheduleDM`, `trackAcceptance` |
| `outreach.js` | 5,089 B | Apollo outreach module for multi-channel sequences | `createSequence`, `sendEmail`, `logOutreach` |

---

## 2. Outreach & DM

Automated direct messaging infrastructure — templates, sequencing, tracking, and self-optimizing delivery.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `automation-first-touch.js` | 5,473 B | Automated first-touch DMs via Rube MCP integration | `generateFirstTouch`, `sendViaMCP`, `logDelivery` |
| `dm-engine.js` | 4,860 B | Self-optimizing DM sequencer with open/reply tracking | `sendSequencedDM`, `trackOpenRate`, `optimizeTemplate` |
| `dm-templates.js` | 6,470 B | Cold DM template library with variable interpolation | `getTemplate`, `interpolateVars`, `abTestSelect` |
| `outreach-engine.js` | 7,966 B | CLI-based outreach CRM tool with pipeline visibility | `trackOutreach`, `updateStatus`, `generateReport` |

---

## 3. Pipeline & CRM

Core pipeline management — CSV-backed CRM, automated health monitoring, and daily momentum dashboards.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `crm.js` | 8,240 B | CSV-based CRM CLI with full CRUD operations | `addLead`, `updateLead`, `searchLeads`, `exportCSV` |
| `pipeline-automation.js` | 3,375 B | Hourly pipeline health check with alert thresholds | `checkPipelineHealth`, `detectBottlenecks`, `sendAlert` |
| `automation-momentum-tracker.js` | 4,167 B | Daily pipeline dashboard with momentum calculations | `calculateMomentum`, `generateDashboard`, `trackTrend` |

---

## 4. Closing

Revenue conversion scripts — pattern-based closing, Stripe abandonment recovery, hot-lead detection, and stall recovery.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `close-rate-engine.js` | 4,086 B | 7 proven sales close patterns with auto-selection | `selectPattern`, `executeClose`, `trackConversion` |
| `automation-speed-close.js` | 7,051 B | Stripe abandonment recovery with 3-stage follow-up | `detectAbandonment`, `triggerStage`, `recoverPayment` |
| `speed-close-trigger.js` | 2,838 B | Hot lead detector using behavioral signals | `monitorSignals`, `scoreUrgency`, `triggerAlert` |
| `automation-nearclose-recovery.js` | 4,518 B | 48-hour stall recovery engine for near-close deals | `detectNearCloseStalls`, `sendRecoverySequence`, `escalate` |

---

## 5. Proof & Content

Automated content generation from client wins — proof loops, daily briefs, and instant close-to-content flywheels.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `automation-proof-loop.js` | 5,431 B | Generate social proof assets from client wins | `generateProofFromWin`, `formatTestimonial`, `queuePost` |
| `automation-content-engine.js` | 5,002 B | Daily content briefs via Zo API integration | `generateDailyBrief`, `fetchZoData`, `scheduleContent` |
| `proof-loop.js` | 7,979 B | Close-to-content flywheel for continuous proof | `processNewClose`, `buildCaseStudy`, `distributeProof` |
| `speed-to-proof.js` | 7,848 B | Instant content generation triggered on deal close | `onClose`, `generateInstantProof`, `publishToChannels` |

---

## 6. Paid Traffic

Multi-platform paid advertising management with ROAS tracking and budget optimization.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `paid-traffic-engine.js` | 7,811 B | 5-platform ad campaign CLI (Meta, Google, LinkedIn, X, TikTok) | `createCampaign`, `trackROAS`, `optimizeBudget`, `pauseUnderperformers` |

---

## 7. Momentum & Control

System-wide orchestration — state machines, master dashboards, real-time alerts, and KPI tracking.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `momentum-controller.js` | 2,267 B | 5-state momentum machine (cold/warm/hot/closing/won) | `evaluateState`, `transitionState`, `getRecommendation` |
| `command-layer.js` | 11,874 B | Master dashboard and full-pipeline orchestrator | `runFullPipeline`, `displayDashboard`, `coordinateScripts` |
| `automation-hot-lead-alert.js` | 3,696 B | Real-time hot lead alerts via Slack/SMS/email | `sendAlert`, `evaluateLeadTemp`, `routeNotification` |
| `kpi-dashboard.js` | 7,800 B | Revenue KPI dashboard with trend analysis | `calculateKPIs`, `renderDashboard`, `comparePeriodsRevenue` |

---

## 8. Utilities

Supporting tools for launch coordination and daily engagement tracking.

| Script | Size | Purpose | Key Functions |
|--------|------|---------|---------------|
| `launch-countdown.js` | 7,606 B | Launch countdown timer with milestone tracking | `getCountdown`, `checkMilestones`, `displayTimer` |
| `linkedin-daily-engagement.js` | 975 B | Daily LinkedIn engagement tracker and logger | `logEngagement`, `calculateEngagementRate` |

### Stubs (Planned)

| Script | Size | Status |
|--------|------|--------|
| `close-patterns.js` | 10 B | Stub — ML-based close pattern analysis (planned) |
| `deal-stacker.js` | 113 B | Stub — Deal bundling and upsell stacking (planned) |

---

## Full Script Index (Alphabetical)

| # | Script | Category | Size |
|---|--------|----------|------|
| 1 | `apollo-search-workflow.js` | Lead Acquisition | 3,732 B |
| 2 | `automation-content-engine.js` | Proof & Content | 5,002 B |
| 3 | `automation-first-touch.js` | Outreach & DM | 5,473 B |
| 4 | `automation-hot-lead-alert.js` | Momentum & Control | 3,696 B |
| 5 | `automation-momentum-tracker.js` | Pipeline & CRM | 4,167 B |
| 6 | `automation-nearclose-recovery.js` | Closing | 4,518 B |
| 7 | `automation-proof-loop.js` | Proof & Content | 5,431 B |
| 8 | `automation-speed-close.js` | Closing | 7,051 B |
| 9 | `close-patterns.js` | Stub | 10 B |
| 10 | `close-rate-engine.js` | Closing | 4,086 B |
| 11 | `command-layer.js` | Momentum & Control | 11,874 B |
| 12 | `crm.js` | Pipeline & CRM | 8,240 B |
| 13 | `deal-stacker.js` | Stub | 113 B |
| 14 | `dm-engine.js` | Outreach & DM | 4,860 B |
| 15 | `dm-templates.js` | Outreach & DM | 6,470 B |
| 16 | `kpi-dashboard.js` | Momentum & Control | 7,800 B |
| 17 | `launch-countdown.js` | Utilities | 7,606 B |
| 18 | `linkedin-daily-engagement.js` | Utilities | 975 B |
| 19 | `linkedin-outreach.js` | Lead Acquisition | 4,297 B |
| 20 | `linkedin-scorer.js` | Lead Acquisition | 5,822 B |
| 21 | `momentum-controller.js` | Momentum & Control | 2,267 B |
| 22 | `outreach-engine.js` | Outreach & DM | 7,966 B |
| 23 | `outreach.js` | Lead Acquisition | 5,089 B |
| 24 | `paid-traffic-engine.js` | Paid Traffic | 7,811 B |
| 25 | `pipeline-automation.js` | Pipeline & CRM | 3,375 B |
| 26 | `proof-loop.js` | Proof & Content | 7,979 B |
| 27 | `speed-close-trigger.js` | Closing | 2,838 B |
| 28 | `speed-to-proof.js` | Proof & Content | 7,848 B |

---

*Auto-generated documentation for the Ghost Engine scripts directory.*
*Last updated: 2026-04-05 | 28 scripts | 8 categories | ~128,879 bytes total*
