#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ghost-engine"
LOG_FILE="$APP_DIR/deploy.log"

echo "========================================" >> "$LOG_FILE"
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Deploy started" >> "$LOG_FILE"

cd "$APP_DIR"

# Pull latest code
git fetch origin master
git reset --hard origin/master

# Install production dependencies
npm ci --production

# Ensure logs directory exists
mkdir -p "$APP_DIR/logs"

# Reload PM2 processes (start if not running)
pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
pm2 save

# Health check
sleep 5
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health --max-time 10 || echo "000")
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Deploy complete - Health: $HEALTH" >> "$LOG_FILE"

if [ "$HEALTH" != "200" ]; then
  echo "WARNING: Health check returned $HEALTH" >&2
fi
