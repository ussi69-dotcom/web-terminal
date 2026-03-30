#!/usr/bin/env bash
set -euo pipefail

deploy_root=${DEPLOY_ROOT:-/home/deploy/apps/deckterm}
releases_dir=${RELEASES_DIR:-"${deploy_root}/releases"}
current_link=${CURRENT_LINK:-"${deploy_root}/current"}
previous_link=${PREVIOUS_LINK:-"${deploy_root}/previous"}
target_port=${TARGET_PORT:-4173}
health_path=${HEALTH_PATH:-/api/health}
systemd_service=${SYSTEMD_SERVICE:-}
xdg_runtime_dir=${XDG_RUNTIME_DIR:-"/run/user/$(id -u)"}

if [[ $# -gt 1 ]]; then
  echo "Usage: $0 [release-id]" >&2
  exit 1
fi

if [[ $# -eq 1 ]]; then
  rollback_target="${releases_dir}/$1"
else
  rollback_target=$(readlink -f "$previous_link")
fi

if [[ -z "${rollback_target:-}" || ! -d "$rollback_target" ]]; then
  echo "Rollback target not found." >&2
  exit 1
fi

ln -sfn "$rollback_target" "$current_link"

if [[ -n "$systemd_service" ]]; then
  XDG_RUNTIME_DIR="$xdg_runtime_dir" systemctl --user restart "$systemd_service"
fi

"$(dirname "$0")/wait_for_health.sh" "http://127.0.0.1:${target_port}${health_path}" 45
