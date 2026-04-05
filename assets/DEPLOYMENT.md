# Deployment Guide — Ghost Engine

## Prerequisites
- Node.js 18+ / npm 9+
- Ubuntu 22.04 or VPS with SSL (Let's Encrypt / Cloudflare)
- API keys: GetResponse, Stripe (test+live), Calendly, OpenAI

## Server Setup
```bash
git clone https://github.com/djbiz/ghost-engine.git
cd ghost-engine && npm install
cp .env.example .env  # edit with your keys
pm2 start ecosystem.config.js
```

## Environment Variables (.env)
```
NODE_ENV=production
PORT=3000
GETRESPONSE_API_KEY=your_key
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
CALENDLY_API_TOKEN=your_token
OPENAI_API_KEY=sk-xxx
DATABASE_URL=postgresql://user:pass@host:5432/ghost
REDIS_URL=redis://localhost:6379
DOMAIN=https://yourdomain.com
```

## Cron Jobs (Heartbeats)
```cron
30 7 * * *  node heartbeats/morning.js
0  9 * * *  node heartbeats/mid-morning.js
0 11 * * *  node heartbeats/midday.js
0 23 * * *  node heartbeats/night.js
0  0 * * *  node scripts/score-decay.js
0  2 * * 0  node scripts/full-rescore.js
```

## Webhooks
**GetResponse:** `POST /api/webhooks/getresponse` — subscribe, unsubscribe, open, click
**Stripe:** `POST /api/webhooks/stripe` — checkout.session.completed, invoice.paid
**Calendly:** `POST /api/webhooks/calendly` — invitee.created, invitee.canceled

## Monitoring
- PM2: `pm2 monit` / `pm2 logs`
- Health check: `GET /api/health` → {status, uptime, memory}
- Logs: `/var/log/ghost-engine/`, rotated weekly

## Backups
- DB: `pg_dump` daily 3AM UTC, 30-day retention
- Config: encrypted to S3/B2 weekly

## Troubleshooting
| Issue | Fix |
|---|---|
| Heartbeat not firing | `crontab -l`, verify paths |
| GetResponse 401 | Refresh API key, restart PM2 |
| Stripe webhook 400 | Verify signing secret |
| High memory | `pm2 restart all` |
| Score not updating | `node scripts/full-rescore.js` |
