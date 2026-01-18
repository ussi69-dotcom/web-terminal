# STATE.md - DeckTerm

> Living memory across sessions. Update after each significant work block.

---

## Current Focus

**Phase:** v2.0 Refactor - Phase 1 (Terminal Scaling Fix)
**Status:** COMPLETE
**Last Updated:** 2026-01-18 21:10

**Active Plan:** `.planning/ROADMAP.md`
**Worktree:** feature/pr4-git-panel (will create new branch for refactor)

## What's Done

### Previous Milestone: Terminal UI Stability (v1.x) - COMPLETE

- [x] Task 0: Worktree + baseline setup
- [x] Task 1: Diagnostika (root-cause evidence) - `35b127a`
- [x] Task 2: Workspace-scoped relayout - `fb4a6a7`
- [x] Task 3: Resize pipeline (per-tile, debounced) - `d4e33e7`
- [x] Task 4: Horizontal overflow strategy - `a4375d6`
- [x] Task 5: Tab colors from cwd with gradient - `accc9c9`
- [x] Task 6: Memory leak cleanup - `88983f9`
- [x] Task 7: Backend resize sync - `b193bd9`
- [x] Task 8: Research doc - `ddd5c3a`

**Post-plan fixes:**

- [x] Fix terminal-colors ESM export for browser - `2a86587`, `51517ea`
- [x] Fix RAM calculation (MemAvailable) - `5733ff5`, `adcda52`
- [x] Tab label/colors via OSC 7 cwd - `0cafd79`
- [x] Gateway execute_job implementation - `54fdf1e`

### Current Milestone: v2.0 Refactor

- [x] Project kickoff - codebase analysis
- [x] Ghostty research for feature inspiration
- [x] Screenshot analysis (UI issues identified)
- [x] PROJECT.md created
- [x] ROADMAP.md created with 5 phases
- [x] Phase 1: Terminal Scaling Fix - COMPLETE (7 commits, 22 tests passing)
- [ ] Phase 2: Platform-Adaptive UI
- [ ] Phase 3: Clipboard Overhaul
- [ ] Phase 4: Session Lifecycle
- [ ] Phase 5: Polish & Testing

## What's In Progress

- [ ] Phase 2: Platform-Adaptive UI (next)

## Decisions Made

| Decision                              | Rationale                                    | Date       |
| ------------------------------------- | -------------------------------------------- | ---------- |
| Per-tile ResizeObserver               | Better than global resize for multi-terminal | 2026-01-12 |
| Sticky cols for horizontal overflow   | xterm.js lacks native h-scroll               | 2026-01-12 |
| FNV-1a hash for cwd colors            | Stable, fast, deterministic                  | 2026-01-12 |
| Keep tmux backend                     | Already implemented, reliable persistence    | 2026-01-18 |
| Platform detection via visualViewport | More reliable than user-agent                | 2026-01-18 |
| Clipboard API + OSC52 fallback        | Modern browsers + TUI compatibility          | 2026-01-18 |
| Extra keys hidden on desktop          | Saves vertical space, keyboard shortcuts OK  | 2026-01-18 |
| 30-min orphan cleanup                 | Balance between persistence and cleanup      | 2026-01-18 |

## Blockers & Open Questions

1. **xterm.js fit addon**: May need custom calculation if addon doesn't account for tmux bar
2. **Image clipboard to Claude Code**: Need to research how Claude Code accepts image input
3. **Mobile keyboard detection**: `visualViewport` API coverage on older Android

## Context for Next Session

> v2.0 Refactor planning complete. Ready to start Phase 1 (Terminal Scaling Fix).
> Key issue: terminal content doesn't fill window (visible in screenshot).

```
Plan file: .planning/ROADMAP.md
Current task: Phase 1 - Terminal Scaling Fix
Next step: Diagnose exact cause of content gap
Key files: web/app.js (ResizeObserver), web/styles.css, backend/server.ts
Watch out for: tmux status bar height, xterm.js fit addon behavior
```

**To resume:** `cd /home/deploy/deckterm_dev && claude` then run `/discuss-phase 1`

## Phase Roadmap Reference

| Phase | Name                 | Status   |
| ----- | -------------------- | -------- |
| 1     | Terminal Scaling Fix | COMPLETE |
| 2     | Platform-Adaptive UI | pending  |
| 3     | Clipboard Overhaul   | pending  |
| 4     | Session Lifecycle    | pending  |
| 5     | Polish & Testing     | pending  |

---

## Session Log

### 2026-01-18 (Phase 1 Complete + Infrastructure Fix)

- Completed: Phase 1 Terminal Scaling Fix (7 commits)
  - d459950: hide tmux status bar
  - b537b26: dimension overlay (Ghostty-style)
  - f63e4e1: minimum 80x24 size warning
  - 4ae579e: debug overlay (Ctrl+Alt+D)
  - fa3d2ab: resize debounce 80ms
  - 6eb5acc: hide status bar for recovered sessions
  - b964d92: Playwright test suite (22 tests)
- Fixed: Port configuration (tests were hitting prod 4173 instead of dev 4174)
- Added: Systemd services for both environments
- Added: CLAUDE.md with port/environment documentation
- Tests: 22/22 passing on port 4174

### 2026-01-18 (Refactor Kickoff)

- Started: v2.0 refactor planning
- Completed: Codebase analysis, Ghostty research, screenshot review
- Created: PROJECT.md, ROADMAP.md (5 phases)
- Key findings:
  - Terminal content gaps due to fit/resize issues
  - Extra keys bar visible on desktop (should hide)
  - Clipboard needs Ctrl+V, auto-copy, image support
  - Session reconnect slow, needs optimization
- Next: Start Phase 1 implementation

### 2026-01-12 - 2026-01-18 (Previous)

- Completed: Terminal UI Stability plan (8 tasks)
- Completed: Post-plan bug fixes (ESM, RAM, OSC 7)
- Completed: Gateway execute_job implementation
- Status: All stable, ready for v2.0 refactor

### 2026-01-12

- Started: Terminal UI stability implementation
- Completed: Tasks 0-8 (all plan tasks)
- Issues: None significant
- Next: Plan complete
