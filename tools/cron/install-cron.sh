#!/usr/bin/env bash
# Adds (or updates) the crontab entry that runs refresh-graphics.sh.
# Safe to re-run: the entry is tagged and replaced, never duplicated.
#
#   tools/cron/install-cron.sh                    default: 06:05 and 18:05 local time
#   tools/cron/install-cron.sh "35 */6 * * *"     any cron schedule
#   tools/cron/install-cron.sh --remove           delete the entry
#
# Cron uses the WSL distro's local time zone (check with `date`).
set -euo pipefail

TAG="# shreesharma07-profile-graphics"
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/refresh-graphics.sh"
LOG="${PROFILE_GRAPHICS_LOG:-$HOME/.local/state/profile-graphics.log}"

current="$(crontab -l 2>/dev/null | grep -vF "$TAG" || true)"

if [[ "${1:-}" == "--remove" ]]; then
  printf '%s\n' "$current" | sed '/^$/d' | crontab -
  echo "removed the profile graphics cron entry"
  exit 0
fi

SCHEDULE="${1:-5 6,18 * * *}"
mkdir -p "$(dirname "$LOG")"
chmod +x "$SCRIPT"
entry="$SCHEDULE $SCRIPT >> $LOG 2>&1 $TAG"
printf '%s\n%s\n' "$current" "$entry" | sed '/^$/d' | crontab -

echo "installed: $entry"
echo "logs:      tail -f $LOG"
if ! pgrep -x cron >/dev/null 2>&1; then
  echo "note: cron is not running; start it with: sudo service cron start"
fi
