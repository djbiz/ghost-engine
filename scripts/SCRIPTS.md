# Scripts - Ghost Engine
28 scripts (P=Purpose K=Fns D=Deps I=Integ)

## 1. Lead
### apollo-search-workflow.js (3732B)
### linkedin-scorer.js (5822B)
### linkedin-outreach.js (4297B)
### outreach.js (5089B)
|P|K|D|I|
|-|-|-|-|
|Apollo CLI|srch filter|Apollo|CRM|
|Score 0-100|scoreLead|LinkedIn|outreach|
|Conn+DM|sendConn|LinkedIn|dm-eng|
|Outreach mod|srch score|Apollo|oreach-eng|

## 2. Outreach
### automation-first-touch.js (3498B)
### dm-engine.js (8498B)
### dm-templates.js (5471B)
### outreach-engine.js (9100B)
|P|K|D|I|
|-|-|-|-|
|First-touch|genFirst|tmpl|dm-eng|
|DM queue|sendDM|tmpl|oreach|
|Tmpl lib|getTempl|store|dm-eng|
|Master|runSeq|dm-eng|CRM|

## 3. CRM
### crm.js (8240B)
### pipeline-automation.js (10553B)
|P|K|D|I|
|-|-|-|-|
|CSV CRM|add list srch|fs csv|pipe|
|Deal pipe|moveDeal|crm|mom|

## 4. Close
### automation-momentum-tracker.js (4167B)
### close-rate-engine.js (6851B)
### automation-speed-close.js (5566B)
### speed-close-trigger.js (3698B)
### automation-nearclose-recovery.js (4830B)
|P|K|D|I|
|-|-|-|-|
|Momentum|track vel|pipe|speed-cl|
|Close rate|calcRate|crm|kpi|
|Urgency|trigUrg|pipe|trigger|
|Triggers|onSig|speed-cl|recov|
|Recovery|detectNr|pipe|dm-eng|

## 5. Proof
### automation-proof-loop.js (3636B)
### automation-content-engine.js (4553B)
### proof-loop.js (2498B)
### speed-to-proof.js (3209B)
|P|K|D|I|
|-|-|-|-|
|Proof|collect fmt|proof|content|
|Content|genContent|tmpl|proof|
|Testim|addTest|fs|content|
|PoC|createDemo|proof|speed-cl|

## 6. Traffic
### paid-traffic-engine.js (7654B)
|P|K|D|I|
|-|-|-|-|
|ROAS|createCamp|Ads|kpi|

## 7. Auto
### momentum-controller.js (5291B)
### command-layer.js (6217B)
|P|K|D|I|
|-|-|-|-|
|Timing|orchestrate|all|kpi|
|Cmd ctrl|issueCmd|mom|all|

## 8. Monitor
### automation-hot-lead-alert.js (3171B)
### kpi-dashboard.js (7628B)
### launch-countdown.js (2498B)
### linkedin-daily-engagement.js (3876B)
|P|K|D|I|
|-|-|-|-|
|Hot alert|monitor|scorer|speed-cl|
|KPI rpt|aggregate|engines|cmd|
|Countdown|setLaunch|config|mom|
|LI engage|dailyEng|LinkedIn|scorer|

*Stubs: close-patterns.js(10B) deal-stacker.js(113B). Non-JS: close-log.jsonl deploy.sh getresponse-nurture.py linkedin-daily-eng. Total ~148KB.*
