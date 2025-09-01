#!/usr/bin/env bash
set -euo pipefail

NAME="up.parlayproz"
OUT_DIR="$NAME"
ARCHIVE="$NAME.tar.gz"

# Clean previous
rm -rf "$OUT_DIR" "$ARCHIVE"

# Install (production) & build if missing .next
if [ ! -d .next ]; then
  echo "Building Next.js output..."
  npm install
  npm run build
fi

# Optionally prune dev deps to shrink size (comment out to keep all)
# npm prune --production || true

mkdir -p "$OUT_DIR"
# Copy required runtime assets
cp -R .next "$OUT_DIR/.next"
# Remove build cache to shrink
rm -rf "$OUT_DIR/.next/cache" || true
cp -R public "$OUT_DIR/public"
cp server.js package.json "$OUT_DIR/"
[ -f package-lock.json ] && cp package-lock.json "$OUT_DIR/"
[ -f next.config.js ] && cp next.config.js "$OUT_DIR/"
# Prefer JS config to avoid TypeScript requirement in production
# If you intentionally keep a TS config, uncomment the next line
# [ -f next.config.ts ] && cp next.config.ts "$OUT_DIR/"
[ -f next.config.mjs ] && cp next.config.mjs "$OUT_DIR/"
[ -f .env.production ] && cp .env.production "$OUT_DIR/"

# Include node_modules (already installed) - this is large
cp -R node_modules "$OUT_DIR/node_modules"

# Create archive
 tar -czf "$ARCHIVE" "$OUT_DIR"

echo "Created $ARCHIVE (folder $OUT_DIR). Upload and extract on server, then:"
echo "cd $OUT_DIR && npm run start:server"
