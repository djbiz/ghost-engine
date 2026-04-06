# SCRIPTS.md -- Ghost Engine
> 28 JS | ~8900L | Sales pipeline | 2026-04-05

## Lead
apollo-search-workflow|320|Apollo 4-seg dedup|runSegmentSearch
linkedin-scorer|280|Score 0-100|calculateScore
linkedin-outreach|350|LI connect DM|sendConnectionRequest
outreach|200|Email seq|createSequence

## Outreach
automation-first-touch|260|Auto DM|generateFirstTouch
dm-engine|420|DM sequencer|sendSequencedDM
dm-templates|180|Template lib|getTemplate
outreach-engine|380|CRM outreach|trackOutreach

## Pipeline
crm|450|CSV CRM CRUD|addLead
pipeline-automation|300|Health check|checkPipelineHealth
momentum-tracker|340|Momentum|calculateMomentum

## Closing
close-rate-engine|380|7 patterns|selectPattern
speed-close|350|Stripe abandon|detectAbandonment
speed-close-trigger|280|Hot lead|monitorSignals
nearclose-recovery|300|48h recovery|detectNearCloseStalls

## Proof
proof-loop-auto|320|Win proof|generateProofFromWin
content-engine|360|Zo briefs|generateDailyBrief
proof-loop|290|Flywheel|processNewClose
speed-to-proof|250|Instant proof|onClose

## Paid
paid-traffic-engine|520|5-platform ROAS|createCampaign

## Momentum
momentum-controller|480|5-state|evaluateState
command-layer|550|Orchestrator|runFullPipeline
hot-lead-alert|220|RT alert|sendAlert
kpi-dashboard|400|KPIs|calculateKPIs

## Util
launch-countdown|150|Countdown|getCountdown
linkedin-daily-engagement|200|Engage|logEngagement
close-patterns|50|Stub ML
deal-stacker|50|Stub bundling
