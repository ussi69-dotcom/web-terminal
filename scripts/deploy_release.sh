#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <release-id>" >&2
  exit 1
fi

release_id=$1
source_dir=${SOURCE_DIR:-$(pwd)}
deploy_root=${DEPLOY_ROOT:-/home/deploy/apps/deckterm}
releases_dir=${RELEASES_DIR:-"${deploy_root}/releases"}
current_link=${CURRENT_LINK:-"${deploy_root}/current"}
previous_link=${PREVIOUS_LINK:-"${deploy_root}/previous"}
shared_dir=${SHARED_DIR:-"${deploy_root}/shared"}
shared_env=${SHARED_ENV:-"${shared_dir}/.env"}
target_port=${TARGET_PORT:-4173}
candidate_port=${CANDIDATE_PORT:-4273}
health_path=${HEALTH_PATH:-/api/health}
keep_releases=${KEEP_RELEASES:-5}
systemd_service=${SYSTEMD_SERVICE:-}
xdg_runtime_dir=${XDG_RUNTIME_DIR:-"/run/user/$(id -u)"}
release_dir="${releases_dir}/${release_id}"
candidate_log=""
candidate_pid=""
current_target=""

cleanup_candidate() {
  if [[ -n "$candidate_pid" ]] && kill -0 "$candidate_pid" 2>/dev/null; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
  fi
}

rollback_live() {
  if [[ -n "$current_target" ]]; then
    ln -sfn "$current_target" "$current_link"
    if [[ -n "$systemd_service" ]]; then
      XDG_RUNTIME_DIR="$xdg_runtime_dir" systemctl --user restart "$systemd_service"
    fi
  fi
}

trap cleanup_candidate EXIT

mkdir -p "$releases_dir" "$shared_dir"
if [[ -e "$release_dir" ]]; then
  echo "Release already exists: $release_dir" >&2
  exit 1
fi

mkdir -p "$release_dir"

rsync -a --delete \
  --exclude '.git' \
  --exclude '.github' \
  --exclude '.worktrees' \
  --exclude 'node_modules' \
  --exclude 'tests/node_modules' \
  --exclude 'tests/test-results' \
  --exclude 'playwright-report' \
  --exclude 'blob-report' \
  --exclude 'test-results' \
  "$source_dir"/ "$release_dir"/

if [[ -f "$shared_env" ]]; then
  ln -sfn "$shared_env" "$release_dir/.env"
fi

(
  cd "$release_dir"
  bun install --frozen-lockfile
)

candidate_log=$(mktemp)
(
  cd "$release_dir"
  PORT="$candidate_port" HOST="127.0.0.1" bun run start >"$candidate_log" 2>&1
) &
candidate_pid=$!

"$source_dir/scripts/wait_for_health.sh" "http://127.0.0.1:${candidate_port}${health_path}" 45
cleanup_candidate
candidate_pid=""

if [[ -L "$current_link" ]]; then
  current_target=$(readlink -f "$current_link" || true)
fi

if [[ -n "$current_target" ]]; then
  ln -sfn "$current_target" "$previous_link"
fi

ln -sfn "$release_dir" "$current_link"

if [[ -n "$systemd_service" ]]; then
  XDG_RUNTIME_DIR="$xdg_runtime_dir" systemctl --user restart "$systemd_service"
fi

if ! "$source_dir/scripts/wait_for_health.sh" "http://127.0.0.1:${target_port}${health_path}" 45; then
  echo "Live health check failed after promoting release ${release_id}" >&2
  if [[ -f "$candidate_log" ]]; then
    cat "$candidate_log" >&2 || true
  fi
  rollback_live
  exit 1
fi

mapfile -t old_releases < <(find "$releases_dir" -mindepth 1 -maxdepth 1 -type d | sort)
if (( ${#old_releases[@]} > keep_releases )); then
  remove_count=$((${#old_releases[@]} - keep_releases))
  for old_release in "${old_releases[@]:0:remove_count}"; do
    if [[ "$old_release" != "$(readlink -f "$current_link" 2>/dev/null || true)" ]] && \
       [[ "$old_release" != "$(readlink -f "$previous_link" 2>/dev/null || true)" ]]; then
      rm -rf "$old_release"
    fi
  done
fi
