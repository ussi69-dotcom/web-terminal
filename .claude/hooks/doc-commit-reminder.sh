#!/usr/bin/env bash
# PostToolUse(Bash) hook — after a git commit touching backend/ or web/, inject a
# non-blocking reminder to record the work (Notion diary, plan, repo docs, features).
# Cheap by design: pure bash + jq, no LLM. The weekly Sonnet routine reconciles
# anything that slips through. Gated to `git commit*` via the hook's `if` rule.
set -uo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null)"

# Defensive: only react to git commit invocations (the `if` rule already gates this).
case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

proj="${CLAUDE_PROJECT_DIR:-$PWD}"

# Files in the most recent commit; only nudge when code paths changed.
files="$(git -C "$proj" show --name-only --pretty=format: HEAD 2>/dev/null || true)"
printf '%s\n' "$files" | grep -qE '^(backend/|web/)' || exit 0

read -r -d '' msg <<'EOF'
📝 Commit do backend/ nebo web/ — než skončíš session, zaznamenej práci:
1) Notion vývojový deník: nová dated entry (Co / Proč / Commit / Status).
2) Plán: zapiš nové úkoly a odškrtni hotové (to_do checked).
3) Repo docs: aktualizuj docs/deckterm-development-overview.md (+ docs/plans/ při změně chování).
4) Nová funkce: popiš ji v sekci „Aktuální stav" na hlavní DeckTerm Notion stránce.
(Týdenní Sonnet routine dožene, co se zapomene — tohle je jen připomínka, neblokuje.)
EOF

jq -cn --arg m "$msg" '{hookSpecificOutput:{hookEventName:"PostToolUse",additionalContext:$m}}'
exit 0
