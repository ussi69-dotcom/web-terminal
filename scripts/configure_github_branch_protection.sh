#!/usr/bin/env bash
set -euo pipefail

repo="${1:-ussi69-dotcom/deckterm}"
token="${GITHUB_PERSONAL_ACCESS_TOKEN:-${GITHUB_TOKEN:-}}"
api_root="https://api.github.com/repos/${repo}/branches"

if [[ -z "$token" ]]; then
  echo "Set GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN first." >&2
  exit 1
fi

apply_protection() {
  local branch=$1
  local review_count=$2
  local payload

  payload=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["unit", "smoke-e2e"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": ${review_count}
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON
)

  curl -fsSL \
    -X PUT \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${token}" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${api_root}/${branch}/protection" \
    -d "${payload}" >/dev/null
}

apply_protection "dev" "${DEV_REVIEW_COUNT:-0}"
apply_protection "main" "${MAIN_REVIEW_COUNT:-1}"

echo "Configured branch protection for ${repo}: dev and main"
