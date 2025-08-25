This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production Deployment (Google Cloud VM + Nginx + PM2)

This repo includes provisioning & update scripts under `deploy/` plus a git helper script.

### 1. Initial Provisioning

On a fresh Ubuntu VM (DNS for your subdomain already pointing to the VM public IP):

1. Copy the repo (or clone) to the server (you can clone after provisioning too).
2. Export required variables (or let the script prompt):
   - `DOMAIN_NAME` (e.g. `app.example.com`)
   - `ADMIN_EMAIL` (Let’s Encrypt notifications)
   - `REPO_URL` (HTTPS or SSH URL to this repository)
3. Run the script as root:

```bash
sudo bash deploy/provision.sh
```

What it does:

- Installs Nginx, git, curl, (optionally) certbot.
- Installs `pm2` globally.
- Clones the repo to `/var/www/parlay-proz` (default) if missing.
- Creates `.env.production` placeholder (edit with real secrets).
- Builds the Next.js app.
- Configures PM2 with `ecosystem.config.cjs` and saves startup.
- Creates Nginx reverse proxy for your domain.
- Obtains Let’s Encrypt certificate (if DNS is correct) and enables HTTPS redirect.

You can customize: `APP_DIR`, `SERVICE_NAME`, `APP_PORT`, `BRANCH`, `NODE_VERSION` by exporting them before running.

### 2. Updating Deployment

To pull the latest changes & rebuild:

```bash
sudo bash deploy/update.sh
```

Actions:

- Fetch & fast-forward the target branch.
- Install dependencies only if `package.json` or lockfile changed.
- Run production build.
- Reload PM2 process (`parlay-proz`).

### 3. Local Git Push Helper

Use `scripts/git-push.sh` to streamline committing & pushing:

```bash
./scripts/git-push.sh "feat: add new component"
```

It stages all changes, commits, rebases against `origin/main` then pushes.

### 4. PM2 Quick Commands

```bash
pm2 status
pm2 logs parlay-proz --lines 100
pm2 reload parlay-proz
pm2 restart parlay-proz
```

### 5. Environment Variables

Edit `.env.production` then reload:

```bash
pm2 reload parlay-proz
```

### 6. SSL Renewal

Certbot sets up a systemd timer for auto-renewal. Test renewal:

```bash
sudo certbot renew --dry-run
```

### 7. Removing the App

```bash
pm2 delete parlay-proz || true
rm -rf /var/www/parlay-proz
rm /etc/nginx/sites-enabled/app.example.com.conf /etc/nginx/sites-available/app.example.com.conf 2>/dev/null || true
nginx -t && sudo systemctl reload nginx
```

### 8. Hardening (Optional / Recommended)

- Configure UFW (allow 22,80,443) & enable.
- Add fail2ban.
- Enable automatic security updates (`unattended-upgrades`).
- Add security headers / CSP after auditing.
