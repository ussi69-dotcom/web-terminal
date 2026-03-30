# Agent State Badges Design

**Goal:** Add agent-aware terminal/tab states for interactive `codex` and `claude` sessions so DeckTerm can distinguish generic `Running` from agent-specific `Thinking` and `Responding`.

## Scope

- Keep existing generic `Running` behavior for all commands.
- Add agent-aware tracking only for interactive `codex` and `claude`.
- Surface two fine-grained states initially:
  - `Thinking`
  - `Responding`
- Keep notifications on completion; do not add `Needs input` yet because we do not have a stable cross-agent marker for it.

## Architecture

1. Bash integration defines wrapper functions for `codex` and `claude`.
2. Wrapper functions emit DeckTerm OSC markers when an agent command starts and when it exits.
3. Backend telemetry parser tracks:
   - generic command running state
   - current agent name
   - current agent phase
4. While an agent is active, backend classifies PTY output:
   - `Thinking` for known progress/status output
   - `Responding` for visible agent text output
5. Backend includes agent state in `terminal_state` and `/api/terminals`.
6. Frontend tab badges prefer agent state over generic `Running`.

## Detection Rules

- `claude`
  - treat chunks containing `Working…`, `Working...`, or `running stop hooks` as `Thinking`
- `codex`
  - treat OSC title updates with braille spinner glyphs as `Thinking`
- both
  - treat visible non-control output as `Responding`

## Risk Management

- Agent-specific logic is gated behind explicit wrapper markers; unrelated commands stay on the current path.
- If agent output cannot be classified, state falls back to generic `Running`.
- No dependency on undocumented remote APIs; only PTY output and shell wrappers are used.

