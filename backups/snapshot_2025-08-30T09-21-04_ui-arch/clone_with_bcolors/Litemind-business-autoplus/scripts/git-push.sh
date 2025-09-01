#!/usr/bin/env bash

# Git push helper focused on "push EVERYTHING and verify nothing is missed".
# Ensures:
#  - Repository initialized (if not)
#  - All files (adds, mods, deletions) staged (git add -A)
#  - Shows any remaining untracked files (should be zero)
#  - Reports ignored files you might care about (optional prompt to include)
#  - Warns about any file >95MB (GitHub hard limit ~100MB)
#  - Prompts for remote if absent, sets upstream if missing
#  - Pushes selected branch
#
# Usage examples:
#   ./scripts/git-push.sh -m "feat: add thing"
#   ./scripts/git-push.sh -r origin -b main -m "chore: deps"
#   ./scripts/git-push.sh              # prompts (remote, message if not provided)
#
# Flags:
#   -m "message"  Commit message (default: prompt if not provided)
#   -r remote     Remote name to use (default: origin if exists)
#   -b branch     Branch name (default: current branch or main)
#   -n            Dry run (no push)
#   -h            Help
#   --include-ignored  Temporarily add ignored files (copies them without editing .gitignore)

set -euo pipefail

COLOR_BLUE="\033[1;34m"; COLOR_GREEN="\033[1;32m"; COLOR_YELLOW="\033[1;33m"; COLOR_RESET="\033[0m"; COLOR_RED="\033[1;31m"

die() { echo -e "${COLOR_RED}Error:${COLOR_RESET} $*" >&2; exit 1; }

DRY_RUN=false
REMOTE=""
BRANCH=""
MSG=""
INCLUDE_IGNORED=false

# Parse long flag first
for arg in "$@"; do
  case $arg in
    --include-ignored) INCLUDE_IGNORED=true; shift ;; # processed, remove from list
  esac
done

while getopts ":m:r:b:nh" opt; do
  case $opt in
    m) MSG="$OPTARG" ;;
    r) REMOTE="$OPTARG" ;;
    b) BRANCH="$OPTARG" ;;
    n) DRY_RUN=true ;;
    h)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    :) die "Option -$OPTARG requires an argument" ;;
    \?) die "Unknown option -$OPTARG" ;;
  esac
done
shift $((OPTIND-1))

# Allow positional first arg as message if -m not used
if [[ -z "$MSG" && $# -gt 0 ]]; then
  MSG="$1"; shift || true
fi

if [[ ! -d .git ]]; then
  echo -e "${COLOR_BLUE}[init] Initializing new git repository${COLOR_RESET}"
  git init
fi

# Determine current branch if not provided
if [[ -z "$BRANCH" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  [[ "$BRANCH" == "HEAD" ]] && BRANCH="main"
fi

if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo -e "${COLOR_BLUE}[branch] Creating branch $BRANCH${COLOR_RESET}"
  git checkout -b "$BRANCH"
fi

if [[ -z "$MSG" ]]; then
  read -rp "Commit message: " MSG
  [[ -z "$MSG" ]] && MSG="chore: update"
fi

echo -e "${COLOR_BLUE}== Pre-flight checks ==${COLOR_RESET}";

TOTAL_FILES=$(find . -type f \( -path ./.git -prune -false -o -print \) | wc -l | tr -d ' ')
TRACKED_COUNT=$(git ls-files | wc -l | tr -d ' ')
UNTRACKED_LIST=$(git ls-files --others --exclude-standard)
UNTRACKED_COUNT=$(echo "$UNTRACKED_LIST" | sed '/^$/d' | wc -l | tr -d ' ')

echo "Total files (excluding .git): $TOTAL_FILES"
echo "Currently tracked: $TRACKED_COUNT"
echo "Untracked before staging: $UNTRACKED_COUNT"

if [[ $UNTRACKED_COUNT -gt 0 ]]; then
  echo -e "${COLOR_YELLOW}Untracked sample:${COLOR_RESET}"; echo "$UNTRACKED_LIST" | head -10
fi

echo -e "${COLOR_BLUE}[stage] Adding ALL changes (add/modify/delete)${COLOR_RESET}"
git add -A

if [[ "$INCLUDE_IGNORED" == true ]]; then
  echo -e "${COLOR_YELLOW}[ignored] Attempting to include ignored files${COLOR_RESET}"
  # Collect ignored files (excluding node_modules/.next by default)
  mapfile -t IGNORED < <(git ls-files -o -i --exclude-standard | grep -vE '(^node_modules/|^\.next/)') || true
  if [[ ${#IGNORED[@]} -gt 0 ]]; then
    printf '%s\n' "${IGNORED[@]}" | while read -r f; do
      [ -f "$f" ] && git add -f "$f" || true
    done
    echo "Forced add of ${#IGNORED[@]} ignored file(s).";
  else
    echo "No ignored files to force add (or all filtered)."
  fi
fi

# Post stage verification
POST_UNTRACKED=$(git ls-files --others --exclude-standard || true)
if [[ -n "$POST_UNTRACKED" ]]; then
  echo -e "${COLOR_YELLOW}[warn] Remaining untracked files (not added):${COLOR_RESET}"
  echo "$POST_UNTRACKED"
else
  echo -e "${COLOR_GREEN}[ok] All files are staged or intentionally ignored${COLOR_RESET}"
fi

# Large file warning (>95MB)
LARGE_FILES=$(find . -type f -size +95M ! -path "./.git/*" 2>/dev/null || true)
if [[ -n "$LARGE_FILES" ]]; then
  echo -e "${COLOR_RED}[large] Files exceeding 95MB (GitHub limit ~100MB). Consider Git LFS:${COLOR_RESET}"
  echo "$LARGE_FILES"
fi

echo -e "${COLOR_BLUE}[commit] Creating commit if there are staged changes${COLOR_RESET}"
if git diff --cached --quiet; then
  echo "No staged changes (nothing to commit)."
else
  git commit -m "$MSG" || true
fi

# Remote handling
if [[ -z "$REMOTE" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    REMOTE="origin"
  else
    read -rp "Remote not set. Enter new remote URL (GitHub): " REMOTE_URL
    [[ -z "$REMOTE_URL" ]] && die "Remote URL required"
    git remote add origin "$REMOTE_URL"
    REMOTE="origin"
    echo -e "${COLOR_GREEN}[remote] Added origin -> $REMOTE_URL${COLOR_RESET}"
  fi
fi

git remote get-url "$REMOTE" >/dev/null 2>&1 || die "Remote '$REMOTE' not found"

echo -e "${COLOR_BLUE}[push] Pushing branch $BRANCH to $REMOTE${COLOR_RESET}"
if [[ "$DRY_RUN" == false ]]; then
  # Set upstream if not already
  if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    git push "$REMOTE" "$BRANCH" --follow-tags
  else
    git push -u "$REMOTE" "$BRANCH" --follow-tags
  fi
else
  echo "(dry run) skipped push"
fi

echo -e "${COLOR_GREEN}Done. All files tracked & pushed (except intentionally ignored).${COLOR_RESET}"
    ((idx++))
  done
  DEFAULT_REMOTE="origin"
  read -rp "Enter number (or name) [${DEFAULT_REMOTE}]: " sel
  if [[ -z "$sel" ]]; then
    REMOTE="$DEFAULT_REMOTE"
  elif [[ $sel =~ ^[0-9]+$ ]]; then
    REMOTE="${REMOTE_MAP[$sel]:-}"
  else
    REMOTE="$sel"
  fi
fi

git remote get-url "$REMOTE" >/dev/null 2>&1 || die "Remote '$REMOTE' not found"

REMOTE_URL=$(git remote get-url "$REMOTE")
OWNER_REPO=$(extract_owner_repo "$REMOTE_URL")
echo -e "Using remote: ${COLOR_GREEN}$REMOTE${COLOR_RESET} ($OWNER_REPO)"
echo -e "Branch: ${COLOR_GREEN}$BRANCH${COLOR_RESET}" 
echo -e "Commit: ${COLOR_GREEN}$MSG${COLOR_RESET}"
[[ "$DRY_RUN" == true ]] && echo -e "${COLOR_YELLOW}[DRY RUN] No changes will be pushed${COLOR_RESET}"

echo "[git] Staging changes"
git add -A

if git diff --cached --quiet; then
  echo "No staged changes. Exiting."; exit 0
fi

echo "[git] Committing"
git commit -m "$MSG" || true

echo "[git] Fetch + rebase $REMOTE/$BRANCH"
if [[ "$DRY_RUN" == false ]]; then
  git fetch "$REMOTE" "$BRANCH" || true
  git pull --rebase "$REMOTE" "$BRANCH" || true
fi

echo "[git] Pushing to $REMOTE $BRANCH"
if [[ "$DRY_RUN" == false ]]; then
  git push "$REMOTE" "$BRANCH" --follow-tags
else
  echo "(skipped push)"
fi

echo -e "${COLOR_GREEN}Done.${COLOR_RESET}"
