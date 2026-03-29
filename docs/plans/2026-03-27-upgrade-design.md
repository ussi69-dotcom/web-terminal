# DeckTerm Upgrade Design

> Date: 2026-03-27
> Status: Drafted from approved upgrade direction
> Scope: gmux-inspired signal import, tmux-rich workflows, and maintainability improvements for DeckTerm

## Summary

DeckTerm already beats `gmux` on product breadth: browser access, mobile usability, file and Git tooling, clipboard flows, reconnect handling, optional tmux persistence, and security controls. `gmux` beats DeckTerm on terminal ergonomics: immediate busy-state visibility, live port cues, worktree awareness, and tighter tmux-native workflow affordances.

This upgrade should not attempt `gmux` parity at the Ghostty layer. It should instead give DeckTerm the runtime awareness and tmux leverage that matter most inside a browser:

- workspace busy indicators
- live dev-server/port indicators
- explicit worktree cues
- one or more first-class tmux workflows in `TMUX_BACKEND` mode
- lower-risk code structure around sessions and telemetry

## Approaches Considered

### Approach A: Browser-Only Incremental Signals

Add tab badges and small backend polling hooks, but keep tmux as an internal persistence detail.

**Pros**

- lowest implementation risk
- preserves existing architecture
- ships the most visible value quickly

**Cons**

- leaves tmux underused
- risks duplicating logic later if tmux-rich features are added separately

### Approach B: Tmux-First Upgrade

Treat tmux as the primary runtime truth for signals and workflows, mirroring `gmux` patterns wherever possible.

**Pros**

- closest conceptual alignment with `gmux`
- strong fit for tmux-backed sessions

**Cons**

- weak fit for raw PTY mode
- encourages browser UX to inherit local-terminal assumptions
- adds more product inconsistency than benefit

### Approach C: Hybrid Telemetry + Optional Tmux Enrichment

Create a backend telemetry seam that feeds browser workspace signals in both modes, then layer tmux-specific upgrades behind `TMUX_BACKEND=1`.

**Pros**

- best fit for DeckTerm's actual product shape
- imports the best of `gmux` without replatforming
- keeps raw PTY and tmux-backed modes compatible
- supports later modularization cleanly

**Cons**

- requires discipline to avoid duplicated telemetry logic
- needs clear feature gating for tmux-only behavior

## Recommended Approach

Use **Approach C: Hybrid Telemetry + Optional Tmux Enrichment**.

DeckTerm is not missing breadth. It is missing sharper runtime awareness. The highest-value move is to create one shared telemetry model and render it well in the browser, then enrich it with tmux-only actions where tmux can offer genuinely better workflows.

## Rejected Alternatives

- full Ghostty shortcut emulation in the browser
- replacing tab/workspace UX with tmux-native metaphors end to end
- rewriting the app around tmux scripts before shipping the first upgrade value
- copying `gmux` path heuristics such as `_worktrees/` substring detection instead of querying Git directly

## Architecture

### 1. Backend Telemetry Layer

Add a dedicated telemetry slice that computes per-terminal or per-workspace metadata:

- `busy`
- `ports`
- `isWorktree`
- `cwdLabel`
- `backendMode`
- optional `tmuxCapabilities`

The implementation can start inside `backend/server.ts` but should aim toward extraction into a focused helper/module so status logic does not remain entangled with all HTTP and WebSocket routes.

### 2. Frontend Workspace Signal Rendering

Extend workspace tab rendering so a workspace can show:

- activity state
- port/dev-server state
- worktree cue
- richer tooltip content

This should build on existing tab color logic rather than replacing it. Current cwd-based colors remain useful, but they should no longer be the only signal.

### 3. Tmux-Rich Capability Gate

When `TMUX_BACKEND=1`, expose richer actions only if the backend confirms they are available. Candidate actions:

- linked session / second view
- session save/restore trigger
- tmux-specific refresh or session action menu

The browser UI must degrade cleanly when tmux is not enabled.

### 4. Worktree Detection

Do not copy `gmux`'s path-based worktree detection. Use Git-aware detection, preferably via `git worktree list --porcelain` or equivalent safe command execution validated inside allowed roots.

### 5. Module Boundaries

This workstream should create seams that reduce risk for future changes:

- backend telemetry/session helpers separated from generic routes
- frontend workspace signal logic separated from the broad `TerminalManager`

The goal is not maximal purity. The goal is reduced coupling around the areas this upgrade touches.

## Validation Strategy

### Automated

- keep `bun run test:unit` passing
- add targeted Playwright coverage on `4174` for:
  - workspace busy/port/worktree signals
  - reconnect compatibility
  - tmux-backed actions where implemented

### Manual

- smoke test raw PTY mode
- smoke test `TMUX_BACKEND=1`
- verify that signals update fast enough to be useful without obvious polling churn
- verify no regression in auth, filesystem path restrictions, or owner isolation

### Acceptance Signals

- a user can identify active/serving/worktree workspaces at a glance
- tmux-backed sessions gain at least one clearly better user workflow
- the upgrade reduces, not increases, confusion in the UI and the codebase
