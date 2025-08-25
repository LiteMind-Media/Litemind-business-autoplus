#!/usr/bin/env bash

# Enhanced git push helper with interactive remote (GitHub account) selection.
#
# Usage examples:
#   ./scripts/git-push.sh -m "feat: add thing"
#   ./scripts/git-push.sh -r origin -b main -m "chore: deps"
#   ./scripts/git-push.sh              # will prompt for commit message & remote
#
# Flags:
#   -m "message"  Commit message (default: prompt if not provided)
#   -r remote     Remote name to use (default: prompt or origin)
#   -b branch     Branch name (default: current branch or main)
#   -n            Dry run (show actions, no push)
#   -h            Help

set -euo pipefail

COLOR_BLUE="\033[1;34m"; COLOR_GREEN="\033[1;32m"; COLOR_YELLOW="\033[1;33m"; COLOR_RESET="\033[0m"; COLOR_RED="\033[1;31m"

die() { echo -e "${COLOR_RED}Error:${COLOR_RESET} $*" >&2; exit 1; }

DRY_RUN=false
REMOTE=""
BRANCH=""
MSG=""

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

if [[ -z "$MSG" ]]; then
  read -rp "Commit message: " MSG
  [[ -z "$MSG" ]] && die "Commit message required"
fi

# Determine current branch if not provided
if [[ -z "$BRANCH" ]]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  [[ "$BRANCH" == "HEAD" ]] && BRANCH="main"
fi

# Collect remotes
mapfile -t REMOTE_LINES < <(git remote -v | awk '{print $1"|"$2}' | sort -u) || die "Not a git repository?"
if [[ ${#REMOTE_LINES[@]} -eq 0 ]]; then
  die "No git remotes configured. Add one: git remote add origin <url>"
fi

extract_owner_repo() {
  local url="$1"; local owner path
  # SSH: git@github.com:owner/repo.git
  if [[ $url =~ github.com:([^/]+)/([^ ]+)$ ]]; then
    owner="${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    echo "$owner"; return
  fi
  # HTTPS: https://github.com/owner/repo.git
  if [[ $url =~ github.com/([^/]+)/([^ ]+)$ ]]; then
    owner="${BASH_REMATCH[1]}/${BASH_REMATCH[2]%.git}"
    echo "$owner"; return
  fi
  echo "$url"
}

if [[ -z "$REMOTE" ]]; then
  echo -e "${COLOR_BLUE}Select remote (GitHub account/org) to use:${COLOR_RESET}"
  idx=1
  declare -A REMOTE_MAP
  for line in "${REMOTE_LINES[@]}"; do
    name="${line%%|*}"; url="${line#*|}";
    REMOTE_MAP[$idx]="$name"
    owner_repo=$(extract_owner_repo "$url")
    printf "  %2d) %-10s %s\n" "$idx" "$name" "$owner_repo"
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
