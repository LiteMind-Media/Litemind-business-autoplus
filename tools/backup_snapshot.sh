#!/usr/bin/env bash
set -euo pipefail
# backup_snapshot.sh (restored)
# Creates backups/snapshot_<timestamp>_<tag>
# Includes .env* by default (use --skip-env to exclude). Add --archive for .tar.gz

TAG="manual"; DO_ARCHIVE=0; SKIP_ENV=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) TAG="$2"; shift 2;;
    --archive|--zip|--compress) DO_ARCHIVE=1; shift;;
    --skip-env) SKIP_ENV=1; shift;;
    -h|--help) echo "Usage: $0 [--tag NAME] [--archive] [--skip-env]"; exit 0;;
    *) echo "Unknown arg: $1" >&2; exit 1;;
  esac
done

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT_DIR" || exit 1
mkdir -p backups
TS="$(date +"%Y-%m-%dT%H-%M-%S")"
DEST="backups/snapshot_${TS}_${TAG}"

echo "[info] Creating snapshot at $DEST"
mkdir -p "$DEST"
EXCLUDES=(--exclude 'node_modules' --exclude '.next' --exclude '.git' --exclude 'backups' --exclude '__pycache__')
[[ $SKIP_ENV -eq 1 ]] && EXCLUDES+=(--exclude '.env*')
rsync -a --quiet "${EXCLUDES[@]}" ./ "$DEST"/
TOTAL=$(find "$DEST" -type f | wc -l | tr -d ' ')
{ echo "Snapshot Timestamp: $(date)"; echo "Root: . (project root)"; echo "Excludes: node_modules, .next, .git, backups, __pycache__"; echo "Env Included: $((SKIP_ENV==0))"; echo "Total Files: $TOTAL"; echo; echo "FILES:"; (cd "$DEST"; find . -type f -maxdepth 25 | sed 's|^./||' | sort); } > "$DEST/MANIFEST.txt"
if [[ $DO_ARCHIVE -eq 1 ]]; then tar -czf "${DEST}.tar.gz" -C backups "$(basename "$DEST")" && echo "[done] Snapshot+archive: ${DEST}.tar.gz"; else echo "[done] Snapshot folder: $DEST"; fi
[[ $SKIP_ENV -eq 0 ]] && echo "[warn] Environment files included." || true
# End of file sentinel: SNAPSHOT_SCRIPT_END
