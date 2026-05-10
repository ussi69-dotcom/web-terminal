#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "WARN: env file not found: $ENV_FILE"
fi

PORT="${PORT:-4174}"
HOST="${HOST:-127.0.0.1}"
DECKTERM_PUBLISH_MODE="${DECKTERM_PUBLISH_MODE:-local}"
HEALTH_HOST="127.0.0.1"

echo "DeckTerm doctor"
echo "env_file=$ENV_FILE"
echo "host=$HOST"
echo "port=$PORT"
echo "publish_mode=$DECKTERM_PUBLISH_MODE"

failed=0

fail_check() {
  echo "FAIL: $1"
  failed=1
}

warn_check() {
  echo "WARN: $1"
}

is_local_bind() {
  [[ "$HOST" == "127.0.0.1" || "$HOST" == "::1" || "$HOST" == "localhost" ]]
}

command -v bun >/dev/null || {
  echo "FAIL: bun is not on PATH"
  exit 1
}

if [[ "${TMUX_BACKEND:-0}" == "1" ]]; then
  command -v tmux >/dev/null || {
    echo "FAIL: TMUX_BACKEND=1 but tmux is not installed"
    exit 1
  }
fi

if [[ "$HOST" == "0.0.0.0" ]]; then
  echo "WARN: HOST=0.0.0.0 exposes DeckTerm on every interface"
fi

case "$DECKTERM_PUBLISH_MODE" in
  local|cloudflare|cloudflare-tunnel|cloudflare-access|nginx|direct)
    ;;
  *)
    warn_check "unknown DECKTERM_PUBLISH_MODE=$DECKTERM_PUBLISH_MODE, expected local/cloudflare-tunnel/cloudflare-access/nginx/direct"
    ;;
esac

is_cloudflare_mode() {
  [[ "$DECKTERM_PUBLISH_MODE" == "cloudflare" \
    || "$DECKTERM_PUBLISH_MODE" == "cloudflare-tunnel" \
    || "$DECKTERM_PUBLISH_MODE" == "cloudflare-access" ]]
}

is_strict_access_mode() {
  [[ "$DECKTERM_PUBLISH_MODE" == "cloudflare" \
    || "$DECKTERM_PUBLISH_MODE" == "cloudflare-access" ]]
}

if is_cloudflare_mode || [[ "$DECKTERM_PUBLISH_MODE" == "nginx" ]]; then
  is_local_bind || fail_check "DECKTERM_PUBLISH_MODE=$DECKTERM_PUBLISH_MODE requires HOST=127.0.0.1"
fi

if is_cloudflare_mode; then
  command -v cloudflared >/dev/null || fail_check "DECKTERM_PUBLISH_MODE=$DECKTERM_PUBLISH_MODE but cloudflared is not installed"
fi

if is_strict_access_mode; then
  [[ "${CF_ACCESS_REQUIRED:-0}" == "1" ]] || fail_check "DECKTERM_PUBLISH_MODE=$DECKTERM_PUBLISH_MODE requires CF_ACCESS_REQUIRED=1 (use cloudflare-tunnel for edge-only protection)"
fi

if [[ "$DECKTERM_PUBLISH_MODE" == "cloudflare-tunnel" && "${CF_ACCESS_REQUIRED:-0}" == "1" ]]; then
  warn_check "DECKTERM_PUBLISH_MODE=cloudflare-tunnel sets CF_ACCESS_REQUIRED=1; switch to cloudflare-access for strict server-side validation"
fi

if [[ "$DECKTERM_PUBLISH_MODE" == "nginx" ]]; then
  command -v nginx >/dev/null || fail_check "DECKTERM_PUBLISH_MODE=nginx but nginx is not installed"
fi

if [[ "$DECKTERM_PUBLISH_MODE" == "direct" ]]; then
  warn_check "direct publishing exposes the Bun app port; prefer a cloudflare-* or nginx mode"
fi

if [[ "${CF_ACCESS_REQUIRED:-0}" == "1" ]]; then
  [[ -n "${CF_ACCESS_TEAM_NAME:-}" ]] || fail_check "CF_ACCESS_REQUIRED=1 but CF_ACCESS_TEAM_NAME is empty"
  [[ -n "${CF_ACCESS_AUD:-}" ]] || fail_check "CF_ACCESS_REQUIRED=1 but CF_ACCESS_AUD is empty"
fi

if [[ "$DECKTERM_PUBLISH_MODE" != "local" && -z "${TRUSTED_ORIGINS:-}" ]]; then
  warn_check "TRUSTED_ORIGINS is empty for published mode"
fi

if [[ -z "${ALLOWED_FILE_ROOTS:-}" ]]; then
  warn_check "ALLOWED_FILE_ROOTS is empty; file and git APIs will fall back to the runtime home"
fi

if [[ -n "${ALLOWED_FILE_ROOTS:-}" ]]; then
  IFS=',' read -ra roots <<<"$ALLOWED_FILE_ROOTS"
  for root in "${roots[@]}"; do
    root="${root#"${root%%[![:space:]]*}"}"
    root="${root%"${root##*[![:space:]]}"}"
    [[ -z "$root" ]] && continue
    if [[ ! -d "$root" ]]; then
      fail_check "ALLOWED_FILE_ROOTS entry does not exist: $root"
    fi
  done
fi

if [[ "$failed" == "1" ]]; then
  exit 1
fi

if command -v ss >/dev/null; then
  ss -ltn "( sport = :$PORT )" || true
fi

if curl -fsS "http://${HEALTH_HOST}:${PORT}/api/health" >/tmp/deckterm-health.json; then
  echo "OK: health endpoint responded"
  cat /tmp/deckterm-health.json
  echo
else
  echo "FAIL: health endpoint did not respond at http://${HEALTH_HOST}:${PORT}/api/health"
  exit 1
fi

echo "OK: doctor checks completed"
