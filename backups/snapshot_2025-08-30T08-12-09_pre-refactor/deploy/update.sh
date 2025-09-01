#!/usr/bin/env bash

# Update script to pull latest code, install dependencies if package changed, rebuild and reload PM2 process.

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/parlay-proz}"
SERVICE_NAME="${SERVICE_NAME:-parlay-proz}"
BRANCH="${BRANCH:-main}"
APP_USER="${APP_USER:-ubuntu}"

cd "$APP_DIR"

echo "=== Updating $SERVICE_NAME in $APP_DIR (branch: $BRANCH) ==="

CURRENT_HASH_BEFORE=$(git rev-parse HEAD || echo "unknown")

echo "[1/5] Fetching latest commits"
sudo -u "$APP_USER" git fetch --all --prune

echo "[2/5] Pulling branch $BRANCH"
sudo -u "$APP_USER" git checkout "$BRANCH"
sudo -u "$APP_USER" git pull --ff-only origin "$BRANCH"

CURRENT_HASH_AFTER=$(git rev-parse HEAD || echo "unknown")

if [[ "$CURRENT_HASH_BEFORE" == "$CURRENT_HASH_AFTER" ]]; then
  echo "No new commits. (hash $CURRENT_HASH_AFTER)"
else
  echo "Updated commit: $CURRENT_HASH_BEFORE -> $CURRENT_HASH_AFTER"
fi

CHANGED_PKGS=false
if git diff --name-only "$CURRENT_HASH_BEFORE".."$CURRENT_HASH_AFTER" | grep -E '^package(-lock)?\.json$' >/dev/null 2>&1; then
  CHANGED_PKGS=true
fi

echo "[3/5] Installing dependencies if needed"
if [[ "$CHANGED_PKGS" == "true" ]]; then
  echo "package.json changed: running npm ci --omit=dev"
  sudo -u "$APP_USER" npm ci --omit=dev || sudo -u "$APP_USER" npm install --production
else
  echo "package.json unchanged: skipping full install"
fi

echo "[4/5] Building application"
sudo -u "$APP_USER" npm run build

echo "[5/5] Reloading PM2 process: $SERVICE_NAME"
pm2 reload "$SERVICE_NAME" || pm2 start ecosystem.config.cjs --only "$SERVICE_NAME"
pm2 save

echo "=== Update complete ==="
pm2 status "$SERVICE_NAME" || true
