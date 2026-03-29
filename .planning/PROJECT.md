# DeckTerm Upgrade

> Versioned upgrade workstream for evolving DeckTerm from a capable web terminal into a sharper agent-oriented terminal platform.

## Project summary

DeckTerm already provides a strong web terminal foundation: PTY sessions, tmux-backed persistence, reconnect, mobile extra keys, file management, Git tooling, clipboard flows, and Cloudflare Access protection. This upgrade workstream focuses on closing the gap between that broad feature set and the tighter terminal ergonomics demonstrated by `gmux`.

The intent is not to turn DeckTerm into a tmux dotfiles repo or replace the browser UI. The intent is to import the highest-signal ideas:

- visible workspace activity state
- live dev-server/port awareness
- explicit worktree cues
- richer tmux-backed workflows when `TMUX_BACKEND=1`
- lower cognitive load in the codebase and in the tab UX

## Problem and users

### Primary users

- developers working on remote Linux servers through a browser
- AI-assisted coding users running Codex / Claude / OpenCode inside terminal sessions
- desktop-first users who want quick situational awareness across multiple workspaces
- mobile users who still need safe, usable terminal interaction from a phone or tablet

### Core problems

- DeckTerm exposes many capabilities, but workspace tabs do not yet surface enough runtime state
- tmux is used mostly as a persistence backend, not yet as a first-class upgrade path
- frontend and backend orchestration around sessions and workspace UI is concentrated in large files
- there is no clear upgrade path for bringing `gmux`-style signals into the web experience without overfitting to Ghostty or local-only workflows

## v1 scope

For this upgrade cycle, "v1 scope" means the first shippable increment of the upgrade workstream:

- add workspace/tab signals for:
  - busy agent activity
  - active dev-server ports
  - worktree status
  - clearer cwd/workspace identity
- add tmux-rich actions behind `TMUX_BACKEND=1`
  - at least one of: linked view, save/restore hooks, richer session actions
- improve keyboard/workspace ergonomics without colliding with browser limitations
- extract session/telemetry responsibilities into smaller modules where it reduces risk
- expand verification for reconnect/activity/tmux-backed behavior on dev port `4174`

## Out of scope

- replacing DeckTerm with tmux or Ghostty
- browser-native emulation of every Ghostty shortcut
- modifying `web/vendor/`
- redesigning Cloudflare Access, filesystem allowlists, or Git/file security model
- native desktop wrapper
- multi-user collaboration features

## Constraints

- runtime remains Bun with Hono backend and vanilla JS frontend
- existing security controls must stay intact:
  - Cloudflare Access support
  - trusted origins logic
  - filesystem allowlist validation
  - owner isolation for terminals
- tests must run against development on port `4174`, never production `4173`
- `TMUX_BACKEND` remains optional; raw PTY mode must keep working
- changes should bias toward incremental upgrades over large rewrites

## Success criteria

- workspace tabs expose enough signal that a user can quickly identify:
  - which workspace is busy
  - which workspace is serving a dev app
  - which workspace is a git worktree
- `TMUX_BACKEND=1` gains at least one materially better user workflow beyond hidden persistence
- reconnect behavior does not regress in raw PTY or tmux-backed mode
- telemetry refresh feels responsive without introducing obvious polling overhead
- session/telemetry code is easier to reason about than the current monolithic shape
- verification covers the new signals and tmux-rich flows

## Verification expectations

- keep `bun run test:unit` passing
- add targeted Playwright coverage for workspace signals and tmux-backed session behavior
- smoke test health and terminal flows on `http://localhost:4174`
- explicitly verify both:
  - raw PTY mode
  - `TMUX_BACKEND=1` mode for the upgraded features

## Notes and open questions

- how much tmux richness belongs in the web UI versus remaining a CLI-only benefit
- whether live port detection should come from a polling backend service, tmux hooks, or both
- whether linked session UX should map to a browser-side concept or a true tmux linked session
- whether busy-state detection should rely on process heuristics, terminal output markers, or a hybrid
