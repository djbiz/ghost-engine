# Lead Scoring Criteria — Ghost Engine

## Overview
Weighted scoring: raw /140, normalized 0-100. Sources: LinkedIn, TikTok, YouTube.

## Scoring Factors (linkedin-scorer.js)
| Factor | Pts | Weight |
|---|---|---|
| Followers | 40 | 28.6% |
| Niche Match | 30 | 21.4% |
| Email | 15 | 10.7% |
| Completeness | 15 | 10.7% |
| Content Signals | 30 | 21.4% |
| Activity | 10 | 7.1% |
| **Total** | **140** | **100%** |

Formula: `(raw / 140) * 100`

## Score Tiers
| Tier | Range | Action |
|---|---|---|
| Hot | 80-100 | Immediate outreach, book call <24h |
| Warm | 60-79 | Nurture sequence, DM + email drip |
| Cold | 40-59 | Long-term nurture, weekly touchpoints |
| Dead | <40 | Archive, no active outreach |

## Platform Criteria
**LinkedIn:** +5 Creator Mode, +3 500+ connections, -5 no photo
**TikTok:** +5 verified, +3 link in bio, -5 inactive 30d
**YouTube:** +5 monetized, +3 consistent uploads, -5 <10 videos

## Niche Keywords
**Primary:** coaching, consulting, course creator, digital products, SaaS, agency, personal brand, e-commerce, fitness, real estate, finance, crypto
**Secondary:** mindset, marketing, social media, podcaster, YouTuber, content creator
Full=30, Partial=15, None=0

## Disqualification (score=0)
Bot/fake, competitor, blacklisted, inactive >6mo, opt-out, duplicate

## Score Decay
7d=-2, 14d=-5, 30d=-10, 60d=-20, 90d=-30. Min=0. Engagement resets timer.
Cron: midnight UTC daily. Full re-score: Sundays 2AM.
