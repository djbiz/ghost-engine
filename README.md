# 👻 Ghost Engine

> AI-powered monetization engine for creators and operators.
> Finds attention. Builds funnels. Closes revenue.

## What It Does

Ghost Engine is a self-reinforcing revenue machine that:
- **Finds** qualified creators with monetization gaps
- **Scores** leads based on revenue potential  
- **Engages** via email + LinkedIn (post-sandbox)
- **Converts** with precision DM sequences
- **Evolves** through daily learning loops

## Quick Start

```bash
# Clone
git clone https://github.com/djbiz/ghost-engine.git
cd ghost-engine

# Add your first lead
node scripts/outreach-engine.js add-lead "Creator Name" "email@example.com" "TikTok" "50000"

# Score and send
node scripts/outreach-engine.js score-lead
node scripts/outreach-engine.js send-batch 10

# Check status
node scripts/command-layer.js status
```

## Architecture

```
ghost-engine/
├── system/          # 3-layer memory (Felix-style)
├── daily/           # Daily notes + template
├── commands/        # Command layer (DOUBLE DOWN/KILL/TEST)
├── scripts/         # Outreach, CRM, scoring, automation
├── assets/          # Ad creatives, DM templates, case studies
└── leads/           # CRM data
```

## The Stack

- **Zo Computer** — AI operating system
- **Apollo** — Lead discovery + enrichment  
- **Stripe** — Payment processing
- **GetResponse** — Email nurture
- **LinkedIn** — Social selling (post-sandbox)
- **Rube** — Cross-app automation

## License

MIT — Build your own Ghost Engine.
