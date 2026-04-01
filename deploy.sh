#!/bin/bash
# ============================================================
#  Trello CRM — VPS Deploy Script
#  Run this on the server after every git pull
#  Usage: bash /root/Trello-CRM-clone/deploy.sh
# ============================================================
set -e

APP_DIR="/root/Trello-CRM-clone"
BACKEND="$APP_DIR/backend"
FRONTEND="$APP_DIR/frontend"

echo ""
echo "============================================================"
echo "  TRELLO CRM — DEPLOYING"
echo "============================================================"

# ── 1. Pull latest code ──────────────────────────────────────
echo ""
echo "[1/6] Pulling latest code..."
cd "$APP_DIR"
git pull origin main

# ── 2. Install / update Python deps ─────────────────────────
echo ""
echo "[2/6] Installing Python dependencies..."
cd "$BACKEND"
venv/bin/pip install -q -r requirements.txt

# ── 3. Build React frontend ──────────────────────────────────
echo ""
echo "[3/6] Building React frontend..."
cd "$FRONTEND"
npm install --silent
npm run build

# ── 4. Collect static files (Django + React combined) ───────
echo ""
echo "[4/6] Collecting static files..."
cd "$BACKEND"
export $(grep -v '^#' .env | xargs)
venv/bin/python manage.py collectstatic --noinput

# ── 5. Run database migrations ───────────────────────────────
echo ""
echo "[5/6] Running migrations..."
venv/bin/python manage.py migrate --noinput

# ── 6. Restart services ──────────────────────────────────────
echo ""
echo "[6/6] Restarting services..."
systemctl restart crm
systemctl reload nginx

sleep 2
echo ""
echo "============================================================"
echo "  DEPLOY COMPLETE!"
echo "  Status:"
systemctl is-active crm && echo "  ✓ Django/Daphne: running" || echo "  ✗ Django/Daphne: FAILED"
systemctl is-active nginx && echo "  ✓ Nginx: running" || echo "  ✗ Nginx: FAILED"
systemctl is-active redis-server && echo "  ✓ Redis: running" || echo "  ✗ Redis: FAILED"
echo "============================================================"
echo ""
