#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/ghost-engine"
LOG_DIR="$APP_DIR/logs"
LOG_FILE="$LOG_DIR/deploy.log"
HEALTH_BASE="${DEPLOY_URL:-http://127.0.0.1:3000}"
HEALTH_URL="${HEALTH_BASE%/}/health"

mkdir -p "$LOG_DIR"

{
  echo "========================================"
  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Deploy started"

  cd "$APP_DIR"
  git fetch origin master
  git reset --hard origin/master
  npm ci
  pm2 reload ecosystem.config.js --env production --update-env || pm2 start ecosystem.config.js --env production --update-env
  pm2 save

  sleep 5
  for attempt in 1 2 3 4 5 6; do
    STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || echo '000')
    if [ "$STATUS" = "200" ]; then
      echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Deploy complete - Health: $STATUS"
      exit 0
    fi

    echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Health check attempt $attempt failed with $STATUS"
    sleep 5
  done

  echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Deploy complete - Health: failed"
  exit 1
} >> "$LOG_FILE" 2>&1
