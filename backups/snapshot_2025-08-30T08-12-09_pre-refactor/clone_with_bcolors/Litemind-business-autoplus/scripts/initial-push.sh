#!/usr/bin/env bash
# Simple one-shot script to publish this project to a GitHub repo.
# Goal: minimal steps so you can then pull it elsewhere.
# Usage: ./scripts/initial-push.sh "Your commit message"

set -euo pipefail

DEFAULT_MSG="Initial commit"
MSG="${1:-$DEFAULT_MSG}"

# 1. Ensure we are in a git repo (init if not)
if [ ! -d .git ]; then
  echo "[init] Initializing new git repository"
  git init
fi

# 2. Ensure main is the default branch (if no commits yet)
if ! git rev-parse --verify main >/dev/null 2>&1; then
  # If HEAD has no commits this will just create branch main
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD || echo "")
  if [ -z "$CURRENT_BRANCH" ] || [ "$CURRENT_BRANCH" = "HEAD" ]; then
    git checkout -b main
  else
    if [ "$CURRENT_BRANCH" != "main" ]; then
      git branch -m "$CURRENT_BRANCH" main || true
    fi
  fi
fi

# 3. Add all files
echo "[stage] Adding all files"
git add -A

# 4. Commit (skip if nothing to commit)
if git diff --cached --quiet; then
  echo "[commit] Nothing new to commit"
else
  echo "[commit] Committing: $MSG"
  git commit -m "$MSG"
fi

# 5. Configure remote if missing
if ! git remote get-url origin >/dev/null 2>&1; then
  read -rp "Enter GitHub repository URL (e.g. https://github.com/user/repo.git or git@github.com:user/repo.git): " REPO_URL
  if [ -z "$REPO_URL" ]; then
    echo "[error] Repository URL required." >&2
    exit 1
  fi
  git remote add origin "$REPO_URL"
  echo "[remote] Added origin -> $REPO_URL"
else
  echo "[remote] origin already configured: $(git remote get-url origin)"
fi

# 6. Push (set upstream)
echo "[push] Pushing main to origin (sets upstream)"
git push -u origin main

echo "[done] Repository published. You can now pull it on the server."
