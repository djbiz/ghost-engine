# Scripts Directory -- Ghost Engine

> Comprehensive documentation for all 28 JavaScript automation scripts powering the Ghost Engine creator monetization pipeline.

**Total Scripts:** 28 (26 active + 2 stubs)  
**Runtime:** Node.js 18+  
**Last Updated:** 2026-04-05

---

## Table of Contents

1. [Lead Acquisition](#1-lead-acquisition) (4 scripts)
2. [Outreach & DM](#2-outreach--dm) (4 scripts)
3. [Pipeline & CRM](#3-pipeline--crm) (3 scripts)
4. [Closing](#4-closing) (4 scripts)
5. [Proof & Content](#5-proof--content) (4 scripts)
6. [Paid Traffic](#6-paid-traffic) (1 script)
7. [Momentum & Control](#7-momentum--control) (4 scripts)
8. [Utilities & Monitoring](#8-utilities--monitoring) (2 scripts)
9. [Stubs (Planned)](#9-stubs-planned) (2 scripts)
10. [Summary Table](#summary-table)

---

## 1. Lead Acquisition

Four scripts for discovering, scoring, and qualifying creator leads through Apollo.io and LinkedIn data enrichment.

---

### apollo-search-workflow.js
**Size:** 3732 bytes | **Category:** Lead Acquisition

**Purpose:** Interactive CLI for Apollo.io lead search across 4 creator segments (fitness 10-50K, coaches 25-100K, lifestyle YouTubers 50K+, LinkedIn leaders 5K+). Reads API key from env, scores by engagement and niche relevance, exports qualified leads to CSV with enriched contact data.

| Field | Details |
|-------|---------|
| **Key Functions** | `searchSegment()`, `scoreResults()`, `exportToCSV()`, `runInteractiveSearch()` |
| **Dependencies** | axios, readline, fs; env APOLLO_API_KEY |
| **Integration Points** | Feeds crm.js and linkedin-scorer.js |

---

### linkedin-scorer.js
**Size:** 5822 bytes | **Category:** Lead Acquisition

**Purpose:** Weighted scoring engine evaluating creators on 6 factors (followers 40pts, niche 30pts, email 15pts, profile 15pts, content 30pts, recency 10pts). Max 140 normalized to 0-100. Tiers: Hot 80+, Warm 60-79, Cold 40-59, Dead <40. Platform modifiers for IG/YT/TT/LI.

| Field | Details |
|-------|---------|
| **Key Functions** | `calculateScore()`, `getScoreTier()`, `applyPlatformModifiers()`, `calculateLinkedInModifiers()` |
| **Dependencies** | None (pure logic module) |
| **Integration Points** | Used by outreach-engine.js, crm.js, pipeline-automation.js |

---

### lead-scraper.js
**Size:** 4250 bytes | **Category:** Lead Acquisition

**Purpose:** Multi-platform scraping engine discovering creator profiles from IG, YT, TikTok, LinkedIn via APIs and web scraping fallbacks. Rate limiting (2/s IG, 5/s YT), proxy rotation, dedup by email hash. Outputs structured lead objects with platform metrics.

| Field | Details |
|-------|---------|
| **Key Functions** | `scrapeInstagram()`, `scrapeYouTube()`, `scrapeTikTok()`, `scrapeLinkedIn()`, `deduplicateLeads()` |
| **Dependencies** | axios, cheerio, puppeteer; env PROXY_LIST, SCRAPER_API_KEY |
| **Integration Points** | Feeds linkedin-scorer.js; stored via crm.js |

---

### niche-finder.js
**Size:** 2910 bytes | **Category:** Lead Acquisition

**Purpose:** Niche discovery tool analyzing trending topics to identify high-opportunity creator niches. Scores by competition density, monetization potential, audience growth rate. Generates weekly reports with recommended outreach segments.

| Field | Details |
|-------|---------|
| **Key Functions** | `analyzeTrends()`, `scoreNiche()`, `generateNicheReport()`, `getTopNiches()` |
| **Dependencies** | axios, fs; env TRENDS_API_KEY |
| **Integration Points** | Outputs feed apollo-search-workflow.js segments |

---

## 2. Outreach & DM

Four scripts managing multi-channel outreach with templates, follow-ups, and reply classification.

---

### outreach-engine.js
**Size:** 6150 bytes | **Category:** Outreach & DM

**Purpose:** Core outreach automation for multi-channel campaigns (IG DM, LinkedIn InMail, email, Twitter DM). A/B testing with significance tracking, send windows 9am-6pm recipient TZ, 50 DMs/day cap per platform, auto cool-down on response.

| Field | Details |
|-------|---------|
| **Key Functions** | `sendOutreach()`, `selectTemplate()`, `trackABTest()`, `manageSendWindow()`, `handleResponse()` |
| **Dependencies** | axios, node-cron, nodemailer; env SMTP_CONFIG, IG_SESSION, LI_TOKEN |
| **Integration Points** | Reads crm.js; uses dm-templates.js; triggers followup-scheduler.js |

---

### dm-templates.js
**Size:** 3480 bytes | **Category:** Outreach & DM

**Purpose:** Template engine with dynamic variable substitution for 12 merge fields. Maintains 6 categories: cold intro, warm follow-up, social proof, case study share, pricing tease, close attempt. Each has 3-4 A/B variants.

| Field | Details |
|-------|---------|
| **Key Functions** | `getTemplate()`, `renderTemplate()`, `getVariantForABTest()`, `listTemplateCategories()` |
| **Dependencies** | handlebars, fs |
| **Integration Points** | Consumed by outreach-engine.js and followup-scheduler.js |

---

### followup-scheduler.js
**Size:** 4102 bytes | **Category:** Outreach & DM

**Purpose:** Follow-up sequencing with configurable delays (2d, 5d, 10d, 21d). Halts on reply, exponential backoff on bounce, escalates hot leads to manual review after 4 touches. Timezone-aware scheduling.

| Field | Details |
|-------|---------|
| **Key Functions** | `scheduleFollowup()`, `checkResponseStatus()`, `escalateToManual()`, `getNextInSequence()` |
| **Dependencies** | node-cron, moment-timezone; reads crm.js |
| **Integration Points** | Triggered by outreach-engine.js; updates crm.js; escalates to deal-tracker.js |

---

### reply-detector.js
**Size:** 2876 bytes | **Category:** Outreach & DM

**Purpose:** NLP reply classifier categorizing messages into 5 types: positive interest, pricing inquiry, objection, not interested, auto-reply/OOO. Keyword matching with weighted scoring and sentiment analysis. Routes to workflow branches.

| Field | Details |
|-------|---------|
| **Key Functions** | `classifyReply()`, `analyzeSentiment()`, `extractIntent()`, `routeToWorkflow()` |
| **Dependencies** | natural (NLP lib); sentiment lexicon in data/ |
| **Integration Points** | Monitors outreach-engine.js replies; updates crm.js; triggers followup branching |

---

## 3. Pipeline & CRM

Three scripts providing centralized lead management, workflow automation, and deal tracking.

---

### crm.js
**Size:** 7230 bytes | **Category:** Pipeline & CRM

**Purpose:** Central CRM with 8-stage lifecycle: new, contacted, engaged, qualified, proposal-sent, negotiating, closed-won, closed-lost. JSON file persistence with atomic writes, bulk ops, query filtering by stage/score/date, full audit trail.

| Field | Details |
|-------|---------|
| **Key Functions** | `addLead()`, `updateStage()`, `queryLeads()`, `getAuditTrail()`, `bulkUpdate()`, `exportPipeline()` |
| **Dependencies** | fs, path; data in data/crm-store.json |
| **Integration Points** | Core dep for outreach-engine, pipeline-automation, deal-tracker, revenue-forecast |

---

### pipeline-automation.js
**Size:** 5190 bytes | **Category:** Pipeline & CRM

**Purpose:** Workflow automation monitoring CRM transitions and triggering downstream actions. Rules engine evaluates score thresholds, time-in-stage limits, engagement signals for auto-ad