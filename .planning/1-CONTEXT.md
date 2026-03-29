# Upgrade Context

> Preferences captured on 2026-03-27 for the `upgrade` workstream.

## Product intent

DeckTerm should remain a web-first remote terminal, but it should feel more aware and more deliberate when multiple agent sessions are running. The upgrade workstream exists to bring the most useful `gmux` ideas into DeckTerm without importing `gmux`'s local Ghostty/tmux assumptions wholesale.

## Captured user preferences

- use the autonomous planning flow as an adaptation over the existing repo
- version this workstream and call it `upgrade`
- ground the work in comparative analysis of current DeckTerm versus `gmux`
- focus on what DeckTerm already does better, what `gmux` does better, and what should actually be reused or optimized
- prefer pragmatic improvements over prestige rewrites

## Scope constraints

- do not replace DeckTerm with a tmux-only workflow
- do not remove current DeckTerm strengths:
  - mobile support
  - multi-user safety controls
  - file/Git/OpenCode integrations
  - reconnect and persistence behavior
- keep security-sensitive areas conservative:
  - auth
  - filesystem access
  - terminal ownership
  - Git/file APIs

## Architecture preference

- preferred approach: hybrid
  - browser-first telemetry and workspace rendering
  - optional tmux enrichments when `TMUX_BACKEND=1`
- avoid a second parallel architecture that only works in tmux mode
- prefer extracting stable seams for telemetry/session state rather than continuing to grow monoliths in `web/app.js` and `backend/server.ts`

## Verification expectations

- keep dev verification on port `4174`
- prefer targeted tests over broad speculative rewrites
- add coverage for:
  - workspace signals
  - reconnect compatibility
  - tmux-rich behavior where implemented
- pause if changes would materially alter:
  - auth boundaries
  - filesystem/Git security guarantees
  - session deletion semantics
