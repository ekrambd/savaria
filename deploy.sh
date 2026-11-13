#!/bin/bash
# ==============================================================================
# Megh Bristi Fashion VPS Auto-Deploy Script
# Solves Git conflicts automatically, protects live orders, builds & restarts PM2
# ==============================================================================

set -e

# Always switch to the directory where this script is located
cd "$(dirname "$0")"

echo "📍 Working directory: $(pwd)"

# Define backup directory
BACKUP_DIR="/tmp/meghbristi_backup"
mkdir -p "$BACKUP_DIR"

echo "🚀 [1/6] Backing up live server orders, database, and uploads..."
cp prisma/*.json "$BACKUP_DIR/" 2>/dev/null || true
cp prisma/*.db "$BACKUP_DIR/" 2>/dev/null || true
if [ -d "public/uploads" ]; then
  mkdir -p "$BACKUP_DIR/uploads"
  cp -rn public/uploads/* "$BACKUP_DIR/uploads/" 2>/dev/null || true
fi

echo "🔄 [2/6] Cleaning working tree to avoid merge conflicts..."
git checkout -- prisma/settings.json 2>/dev/null || true
git stash --include-untracked 2>/dev/null || true

echo "📥 [3/6] Fetching latest updates from GitHub..."
git fetch origin

# Auto-detect target branch (main or master or current)
TARGET_BRANCH="main"
if git show-ref --quiet refs/remotes/origin/main; then
  TARGET_BRANCH="main"
elif git show-ref --quiet refs/remotes/origin/master; then
  TARGET_BRANCH="master"
else
  TARGET_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "master")
fi

echo "🌿 Deploying branch: origin/$TARGET_BRANCH"
git reset --hard "origin/$TARGET_BRANCH"

echo "🛡️ [4/6] Restoring live customer orders & SQLite database..."
if [ -s "$BACKUP_DIR/orders.json" ]; then
  cp "$BACKUP_DIR/orders.json" prisma/ 2>/dev/null || true
fi
if [ -s "$BACKUP_DIR/abandoned_carts.json" ]; then
  cp "$BACKUP_DIR/abandoned_carts.json" prisma/ 2>/dev/null || true
fi

# Restore any SQLite database files (*.db)
for db_file in "$BACKUP_DIR"/*.db; do
  if [ -f "$db_file" ]; then
    cp "$db_file" prisma/ 2>/dev/null || true
  fi
done

# Restore uploads if missing
if [ -d "$BACKUP_DIR/uploads" ]; then
  mkdir -p public/uploads
  cp -rn "$BACKUP_DIR/uploads/"* public/uploads/ 2>/dev/null || true
fi

# Ensure uploads folder exists with full write permissions
mkdir -p public/uploads
chmod -R 755 public/uploads 2>/dev/null || true
chmod -R 755 prisma 2>/dev/null || true

# Check & ensure Nginx allows 100MB uploads (prevents HTTP 413)
if [ -f /etc/nginx/nginx.conf ] && ! grep -q "client_max_body_size" /etc/nginx/nginx.conf; then
  echo "🔧 Configuring Nginx upload limit to 100M..."
  sed -i '/http {/a \    client_max_body_size 100M;' /etc/nginx/nginx.conf 2>/dev/null || true
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
fi

echo "📦 [5/6] Updating dependencies & generating database schema..."
npm install --no-audit 2>/dev/null || npm install
npx prisma generate

echo "⚡ [6/6] Building production bundle & restarting PM2..."
npm run build

# Smart PM2 process reload/restart/start
if command -v pm2 &>/dev/null; then
  if pm2 list | grep -q "meghbristi"; then
    echo "🔄 Restarting PM2 process: meghbristi"
    pm2 restart meghbristi --update-env
  elif pm2 list | grep -q "megh-bristi"; then
    echo "🔄 Restarting PM2 process: megh-bristi"
    pm2 restart megh-bristi --update-env
  elif pm2 list | grep -q "leafcurt"; then
    echo "🔄 Restarting PM2 process: leafcurt"
    pm2 restart leafcurt --update-env
  elif pm2 list | grep -q "store-platform"; then
    echo "🔄 Restarting PM2 process: store-platform"
    pm2 restart store-platform --update-env
  elif pm2 list | grep -q "online"; then
    echo "🔄 Restarting all active PM2 processes"
    pm2 restart all --update-env
  else
    echo "🚀 Starting server with PM2..."
    pm2 start dist/server.cjs --name "meghbristi" || pm2 start npm --name "meghbristi" -- run start
  fi
  pm2 save 2>/dev/null || true
else
  echo "⚠️ PM2 not found globally. Please start the server using: npm run start"
fi

echo "✅ =================================================================="
echo "✅ Megh Bristi Fashion updated and deployed successfully!"
echo "✅ =================================================================="
