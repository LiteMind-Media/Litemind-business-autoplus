#!/usr/bin/env bash

# Provision script for Ubuntu (Google Cloud VM) to set up production stack for this Next.js app.
# Idempotent where possible. Safe to re-run (will skip existing resources).

set -euo pipefail

###############################################
# --------- CONFIGURABLE VARIABLES --------- #
###############################################

# REQUIRED: Set these before running OR will be prompted.
DOMAIN_NAME="${DOMAIN_NAME:-}"          # e.g. app.example.com (subdomain)
ADMIN_EMAIL="${ADMIN_EMAIL:-}"          # Email for Let's Encrypt notifications

# OPTIONAL / Defaults
APP_USER="${APP_USER:-ubuntu}"          # System user that will own the app directory
APP_DIR="${APP_DIR:-/var/www/parlay-proz}"  # Where the repo will live
REPO_URL="${REPO_URL:-}"                # e.g. https://github.com/your-org/your-repo.git
BRANCH="${BRANCH:-main}"               # Git branch to deploy initially
NODE_VERSION="${NODE_VERSION:-}"        # If set, will install via nvm (e.g. 20.15.1). If empty, assumes Node already installed.
SERVICE_NAME="${SERVICE_NAME:-parlay-proz}" # PM2 process name
APP_PORT="${APP_PORT:-3000}"           # Internal port the Next.js server listens on
INSTALL_CERTBOT="${INSTALL_CERTBOT:-true}" # Set false to skip certbot (e.g., staging)

###############################################
# ------------- PRE-RUN CHECKS -------------- #
###############################################

if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] Please run as root (sudo)." >&2
  exit 1
fi

# Prompt if required vars missing
if [[ -z "$DOMAIN_NAME" ]]; then
  read -rp "Enter fully qualified domain (subdomain) to configure (e.g. app.example.com): " DOMAIN_NAME
fi
if [[ -z "$ADMIN_EMAIL" ]]; then
  read -rp "Enter admin email for Let's Encrypt: " ADMIN_EMAIL
fi
if [[ -z "$REPO_URL" ]]; then
  read -rp "Enter Git repository URL (HTTPS or SSH): " REPO_URL
fi

echo "=== Provisioning for $DOMAIN_NAME (repo: $REPO_URL) ==="

###############################################
# ----------- SYSTEM PACKAGES --------------- #
###############################################
echo "[1/9] Updating apt cache & installing base packages"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  nginx git curl build-essential ca-certificates jq

if [[ "$INSTALL_CERTBOT" == "true" ]]; then
  apt-get install -y certbot python3-certbot-nginx
fi

###############################################
# ------------- NODE / NVM ------------------ #
###############################################
if [[ -n "$NODE_VERSION" ]]; then
  if ! command -v nvm >/dev/null 2>&1; then
    echo "[2/9] Installing nvm"
    export NVM_DIR="/usr/local/nvm"
    mkdir -p "$NVM_DIR"
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck disable=SC2016
    echo 'export NVM_DIR="/usr/local/nvm"' > /etc/profile.d/nvm.sh
    echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> /etc/profile.d/nvm.sh
    # Load nvm for this script
    # shellcheck disable=SC1091
    source /etc/profile.d/nvm.sh
  else
    # shellcheck disable=SC1091
    source /etc/profile.d/nvm.sh || true
  fi
  echo "[3/9] Installing Node $NODE_VERSION via nvm"
  nvm install "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
fi

echo "[4/9] Ensuring npm & pm2 globally installed"
npm install -g pm2@latest

###############################################
# ------------- APPLICATION CODE ------------ #
###############################################
echo "[5/9] Creating app directory & cloning repo (if needed)"
mkdir -p "$APP_DIR"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "Repo already present. Skipping clone."
fi

###############################################
# ------------- ENV / DEPENDENCIES ---------- #
###############################################
cd "$APP_DIR"
if [[ ! -f .env.production ]]; then
  echo "Creating placeholder .env.production (edit with real secrets)"
  cat > .env.production <<EOF
# Add production environment variables here
# EXAMPLE_API_URL=https://api.example.com
EOF
  chown "$APP_USER":"$APP_USER" .env.production
fi

echo "[6/9] Installing production dependencies & building"
sudo -u "$APP_USER" npm ci --omit=dev || sudo -u "$APP_USER" npm install --production
sudo -u "$APP_USER" npm run build

###############################################
# ------------- PM2 PROCESS ----------------- #
###############################################
echo "[7/9] Configuring PM2 ecosystem"
cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [
    {
      name: '$SERVICE_NAME',
      script: 'server.js',
      env: {
        NODE_ENV: 'production',
        PORT: '$APP_PORT'
      }
    }
  ]
};
EOF
chown "$APP_USER":"$APP_USER" ecosystem.config.cjs

sudo -u "$APP_USER" pm2 start ecosystem.config.cjs || true
pm2 save
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null 2>&1 || true

###############################################
# ------------- NGINX CONFIG ---------------- #
###############################################
echo "[8/9] Configuring Nginx reverse proxy for $DOMAIN_NAME"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN_NAME.conf"
if [[ ! -f "$NGINX_CONF" ]]; then
  cat > "$NGINX_CONF" <<EOF
server {
  listen 80;
  listen [::]:80;
  server_name $DOMAIN_NAME;

  # Increase buffer sizes for larger headers if needed
  client_max_body_size 20M;

  location / {
    proxy_pass http://127.0.0.1:$APP_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # Basic security headers (add CSP as needed)
  add_header X-Frame-Options DENY;
  add_header X-Content-Type-Options nosniff;
  add_header Referrer-Policy same-origin;
}
EOF
  ln -s "$NGINX_CONF" "/etc/nginx/sites-enabled/$DOMAIN_NAME.conf"
fi

nginx -t
systemctl reload nginx

###############################################
# ------------- SSL CERTBOT ----------------- #
###############################################
if [[ "$INSTALL_CERTBOT" == "true" ]]; then
  echo "[9/9] Obtaining Let's Encrypt certificate via certbot"
  if certbot certificates | grep -q "$DOMAIN_NAME"; then
    echo "Certificate already exists. Skipping issuance."
  else
    certbot --nginx -d "$DOMAIN_NAME" --non-interactive --agree-tos --email "$ADMIN_EMAIL" --redirect || {
      echo "[WARN] Certbot failed. You can retry manually later.";
    }
  fi
else
  echo "Skipping certbot per INSTALL_CERTBOT flag"
fi

echo "=== Provisioning complete ==="
echo "PM2 processes:" && pm2 ls
echo "Access: https://$DOMAIN_NAME (if DNS + SSL succeeded)"
