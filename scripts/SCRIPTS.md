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

Four scripts responsible for discovering, scoring, and qualifying creator leads through Apollo.io and LinkedIn data enrichment.

---

### apollo-search-workflow.js
**Size:** 3732 bytes | **Category:** Lead Acquisition

**Purpose:** Interactive CLI tool for Apollo.io lead search across 4 predefined creator segments (fitness creators 10-50K, business coaches 25-100K, lifestyle YouTubers 50K+, LinkedIn thought leaders 5K+). Reads Apollo API key from env, scores results, exports to CSV.

| Field | Details |
|-------|---------|
| **Key Functions** | `searchSegment()`, `scoreResults()`, `exportToCSV()`, `runInteractiveSearch()` |
| **Dependencies** | `axios`, `readline`, `fs`; env var `APOLLO_API_KEY` |
| **Integration Points** | Feeds leads into `crm.js` and `linkedin-scorer.js` |
| **Usage** | `node scripts/apollo-search-workflow.js` |
| **Configuration** | 4 hardcoded segments with follower ranges and niche keywords |

---

### linkedin-scorer.js
**Size:** 5822 bytes | **Category:** Lead Acquisition

**Purpose:** Weighted lead scoring engine evaluating creators across 6 factors (followers 40pts, niche 30pts, email 15pts, profile 15pts, content signals 30pts, activity recency 10pts). Raw max 140, normalized 0-100. Tiers: Hot 80+, Warm 60-79, Cold 40-59, Dead below 40.

| Field | Details |
|-------|---------|
| **Key Functions** | `calculateScore()`, `getScoreTier()`, `applyPlatformModifiers()`, `calculateLinkedInModifiers()` |
| **Dependencies** | None (pure logic module) |
| **Integration Points** | Used by `outreach-engine.js`, `crm.js`, `pipeline-automation.js` |
| **Usage** | `require('./linkedin-scorer')` then call `calculateScore(leadData)` |
| **Configuration** | 