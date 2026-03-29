# STATE.md - DeckTerm Upgrade

> Living memory across sessions. Update after each significant work block.

---

## Current Focus

**Phase:** 1 - Workspace Signals & Telemetry
**Status:** PLAN READY
**Mode:** autonomous-kickoff
**Last Updated:** 2026-03-27 22:17 UTC

**Active Plan:** `docs/plans/2026-03-27-upgrade.md`
**Worktree:** `/home/deploy/deckterm`
**Design Doc:** `docs/plans/2026-03-27-upgrade-design.md`

## What's Done

- [x] Existing DeckTerm baseline established
  - web PTY terminal
  - reconnect + scrollback replay
  - optional tmux backend persistence
  - file manager
  - Git panel
  - clipboard + OSC52 flows
  - OpenCode integration
  - Cloudflare Access support
- [x] Previous v2.x planning/history preserved in repo docs and commits
- [x] Comparative research against `gmux` completed
- [x] Upgrade workstream versioned and named `upgrade`
- [x] Upgrade design doc written
- [x] Upgrade implementation plan written

## What's In Progress

- [ ] Phase 1 implementation has not started yet
- [ ] Final choice of tmux-rich feature set for Phase 2 remains open

## Decisions Made

| Decision | Rationale | Date |
| --- | --- | --- |
| Treat this as an upgrade adaptation, not a fresh kickoff | Repo already has significant code and existing autonomous memory | 2026-03-27 |
| Name the new workstream `upgrade` | User explicitly requested versioning under this name | 2026-03-27 |
| Use hybrid browser-first telemetry with optional tmux enrichments | Preserves DeckTerm strengths while importing the best of `gmux` | 2026-03-27 |
| Keep DeckTerm as a web-first product | `gmux` is inspiration, not a product replacement path | 2026-03-27 |
| Detect worktrees via Git data, not path substring heuristics | More reliable than matching `_worktrees/` in paths | 2026-03-27 |
| Preserve both raw PTY and tmux-backed operation | tmux remains optional in current architecture | 2026-03-27 |

## Blockers & Open Questions

1. Busy-state signal source:
Should this come from process heuristics, terminal output markers, or both?

2. Port detection architecture:
Should we poll from the backend, mirror `gmux`-style process-tree detection, or reuse tmux-side data when available?

3. Tmux-rich browser UX:
Should linked sessions appear as browser-level workspaces, true tmux linked sessions, or both?

4. Refactor boundaries:
How much extraction from `web/app.js` / `backend/server.ts` is safe in the same cycle as feature work?

## Context for Next Session

Plan file: `docs/plans/2026-03-27-upgrade.md`
Current task: Phase 1 kickoff - codify workspace metadata contract and first failing tests
Next step: implement the backend/frontend telemetry seam without regressing reconnect behavior
Key files: `backend/server.ts`, `web/app.js`, `web/styles.css`, `web/terminal-colors.js`, `web/terminal-colors.test.js`, `tests/`
Watch out for: `TMUX_BACKEND` parity, polling overhead, browser shortcut conflicts, existing auth/path guardrails

---

## Session Log

### 2026-03-27

- Reviewed current DeckTerm implementation and planning state
- Researched `OndrejDrapalik/gmux` directly from the live repository
- Compared DeckTerm strengths versus `gmux`
- Selected upgrade direction:
  - import runtime signals and tmux-rich ideas
  - avoid copying Ghostty-local assumptions into the browser product
- Rebased autonomous planning memory onto the new `upgrade` workstream

### Historical Note

- Earlier v2.0 planning artifacts and execution history remain part of repo history and existing docs.
- This state file is now the source of truth for the `upgrade` workstream.
