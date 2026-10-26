#!/usr/bin/env bash
# Regenerates the contribution snake and 3D city, then commits and pushes them
# to the profile repo. The cron replacement for snake.yml and profile-3d.yml.
#
#   tools/cron/refresh-graphics.sh             generate, commit, push
#   tools/cron/refresh-graphics.sh --no-push   generate and commit only
#
# Point it at a dedicated clone (not the checkout you edit in), because it
# pulls and commits on its own. Install the schedule with tools/cron/install-cron.sh.
#
# Environment (all optional):
#   PROFILE_REPO   clone to work in   (default: the repo this script lives in)
#   PROFILE_BRANCH branch to update   (default: main)
#   GITHUB_TOKEN   token for the generators (else tools/.env, see refresh-graphics.mjs)
set -euo pipefail

REPO="${PROFILE_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
BRANCH="${PROFILE_BRANCH:-main}"
PUSH=1
[[ "${1:-}" == "--no-push" ]] && PUSH=0

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# cron starts with a bare PATH; load nvm or fnm if Node came from one of them.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"
  command -v fnm >/dev/null 2>&1 && eval "$(fnm env)"
fi
command -v node >/dev/null 2>&1 || { log "node not found on PATH"; exit 1; }

cd "$REPO"
mkdir -p tools/.cache

# One run at a time, even if a slow run overlaps the next tick.
exec 9>tools/.cache/refresh-graphics.lock
flock -n 9 || { log "another run is in progress, skipping"; exit 0; }

log "updating $REPO ($BRANCH)"
git checkout --quiet "$BRANCH"
git pull --quiet --rebase --autostash origin "$BRANCH"

# Install the builder's dependencies only when they are missing or the lockfile changed.
STAMP=tools/node_modules/.lock-hash
HASH="$(sha256sum tools/package-lock.json | cut -d' ' -f1)"
if [[ ! -f "$STAMP" || "$(cat "$STAMP")" != "$HASH" ]]; then
  log "installing tools dependencies"
  npm ci --prefix tools --no-audit --no-fund --silent
  echo "$HASH" > "$STAMP"
fi

# A failed graphic keeps its old file; still commit whichever one succeeded.
STATUS=0
node tools/refresh-graphics.mjs || STATUS=$?

FILES=(assets/profile-snake/snake-dark.svg assets/profile-3d-contrib/profile-city.svg)
git add -- "${FILES[@]}"
if git diff --cached --quiet -- "${FILES[@]}"; then
  log "graphics unchanged, nothing to commit"
  exit "$STATUS"
fi

git commit --quiet -m "chore: refresh contribution graphics" -- "${FILES[@]}"
log "committed $(git rev-parse --short HEAD)"

if (( PUSH )); then
  # The gh-profile-worker may commit stats in between; rebase and retry.
  for attempt in 1 2 3; do
    if git push --quiet origin "$BRANCH"; then
      log "pushed to origin/$BRANCH"
      exit "$STATUS"
    fi
    log "push rejected (attempt $attempt), rebasing"
    git pull --quiet --rebase origin "$BRANCH"
  done
  log "push failed after 3 attempts"
  exit 1
fi
exit "$STATUS"
