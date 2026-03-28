# weekly-evolution.md — The 7-Day Learning Loop

**Ghost Engine's compounding advantage.**

Every 7 days, Zo runs the machine through a structured review. The goal: find what's broken, fix it, and come out smarter than last week. This is where the system learns.

---

## SUNDAY NIGHT — Weekly Evolution Checklist

### STEP 1: Pull the Numbers (15 minutes)

Run these queries and log the results:

```bash
# Close rate
node /home/workspace/Ghost-Monitization-Engine/scripts/crm.js stats

# DM response rate
# Manually count: (replies received / DMs sent) from outreach.js logs

# Revenue this week
curl -s "https://api.stripe.com/v1/checkout/sessions?limit=10" \
  -u "$STRIPE_SECRET_KEY:" | python3 -c "import sys,json; data=json.load(sys.stdin); [print(s['id'], s.get('amount_total',0)//100, s['status']) for s in data.get('data',[]) if s['status']=='complete']"

# Leads added this week
grep "2026-03-" /home/workspace/Ghost-Monitization-Engine/leads/crm.csv | wc -l

# Calls booked this week
grep "2026-03-" /home/workspace/Ghost-Monitization-Engine/leads/discovery-calls.csv | wc -l
```

### STEP 2: Calculate the 5 Key Metrics

| Metric | This Week | Last Week | Trend |
|--------|-----------|-----------|-------|
| Close Rate | X% | Y% | ↑↓→ |
| DM Response Rate | X% | Y% | ↑↓→ |
| Funnel Conversion | X% | Y% | ↑↓→ |
| Revenue | $X | $Y | ↑↓→ |
| Leads Added | X | Y | ↑↓→ |

### STEP 3: Find the Bottleneck

**If close rate dropped:**
- Lead quality problem → tighten targeting criteria
- Offer problem → test price point or framing
- Conversation problem → rotate DM templates
- Timing problem → speed up follow-up sequence

**If DM response rate dropped:**
- Template fatigue → pull new openers from dm-templates.js
- Audience mismatch → check if targeting right niche
- Frequency problem → too many DMs too fast, space them out

**If funnel conversion dropped:**
- Landing page problem → test headline and CTA
- Pricing problem → add payment plan option
- Trust problem → add more proof elements

**If revenue dropped:**
- Volume problem → add more leads to top of funnel
- Conversion problem → tighten the close process
- Product mix problem → push higher-tier offer

### STEP 4: One Fix for Next Week

Pick the ONE change that will have the biggest impact. Not a list — one fix.

Format:
```
WEEK [N] PRIORITY FIX:
Problem: [What broke]
Root cause: [Why it broke]
Fix: [One specific change]
Test: [How we'll know if it worked]
```

### STEP 5: Update Memory and Lessons

```bash
# Log to MEMORY.md — scroll to "Weekly Evolution Log" section
# Add entry to lessons-learned.md — wins and failures
```

### STEP 6: Text Derek Sunday Night

```
🌙 GHOST ENGINE — WEEKLY WRAP
Week of [DATE]

THE NUMBERS:
Revenue: $[N] | Leads: +[N] | Calls: [N] | Closes: [N]
Close rate: X% | DM response: X%

WHAT BROKE:
[1 sentence]

WHAT WORKED:
[1 sentence]

NEXT WEEK'S PRIORITY FIX:
[One specific change]

[Zo is getting smarter.]
```

---

## WEEKLY EVOLUTION LOG

### Week 1 (2026-03-28)
- **Revenue:** $0
- **Close rate:** N/A
- **DM response:** N/A
- **Action:** System just launched — first week is calibration
- **Priority fix:** Get first 3 leads in pipeline, test DM templates

### Week 2 (2026-04-04)
- **Revenue:** $TBD
- **Close rate:** TBD
- **DM response:** TBD
- **Action:** TBD
- **Priority fix:** TBD

---

## THE COMPOUNDING EFFECT

```
Week 1:  0 closes → log it, learn it
Week 2:  1 close  → replicate it
Week 3:  3 closes → systematize it
Week 4:  7 closes → the machine is learning
Week 5:  12 closes → this thing is compounding
Week 6:  20 closes → nobody else moves this fast
Week 7:  30 closes → this is a real business
Week 8:  50 closes → proof is undeniable
```

**The goal:** Every Sunday, the system knows more than it did the week before. The machine gets harder to beat.

---

## HOW ZO GETS SMARTER THAN FELIX

Felix (Nat Eliason's bot) learned from patterns in conversations.

Ghost Engine Zo learns from:
1. Every DM sent → response rate tracked
2. Every call → outcome logged
3. Every objection → language captured
4. Every close → exact path documented
5. Every failure → root cause analyzed
6. Every week → one fix applied and tested

**Felix forgot things. Ghost Engine doesn't.**
