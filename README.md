# DeckTerm

DeckTerm is a browser-based terminal workspace for long-running remote development sessions.

It combines persistent tmux-backed shells, workspace tabs, split tiles, mobile-first controls, file and git tooling, and agent-aware status signals into one interface. The product direction is inspired by Ghostty's calm terminal UX, Termux-style mobile ergonomics, VS Code-style workspace affordances, and the practical needs of Codex and Claude-driven server workflows.

## What It Does

- Persistent tmux-backed terminal sessions that survive browser reconnects and service restarts
- Workspace tabs with split terminals, drag-to-merge behavior, linked views, and cwd-based color signals
- Mobile-friendly terminal controls with extra keys, viewport-aware focus recovery, and image/text clipboard handling
- Built-in file manager for browse, upload, download, mkdir, rename, and delete inside allowed roots
- Built-in git panel and git APIs for status, diff, stage, unstage, commit, branch, checkout, log, and show
- Agent-aware workspace badges such as `Codex` and `Codex Responding`
- Release-based production deployment from `main` with CI verification and atomic rollout

## Product Snapshot

DeckTerm today is optimized for one practical job: keep remote coding sessions usable from desktop and mobile without losing context.

Current product pillars:

1. Session continuity
2. Workspace management
3. Mobile usability
4. File and git operations close to the terminal
5. Safe promotion from `dev` to `main`

For the full current-state description, see [docs/product-guide.md](/home/deploy/deckterm_dev/docs/product-guide.md).
For rollout and CI/CD details, see [deploy/README.md](/home/deploy/deckterm_dev/deploy/README.md) and [docs/operations-guide.md](/home/deploy/deckterm_dev/docs/operations-guide.md).

## Runtime Model

Two separate environments are used on the server:

| Port | Role | Source | Service |
| --- | --- | --- | --- |
| `4174` | Development | [`/home/deploy/deckterm_dev`](/home/deploy/deckterm_dev) | `deckterm-dev.service` |
| `4173` | Production | release symlink under `/home/deploy/apps/deckterm/prod/current` | `deckterm.service` |

Important:

- Development work happens in [`/home/deploy/deckterm_dev`](/home/deploy/deckterm_dev) on branch `dev`
- Production no longer runs directly from a live git checkout
- `main` deploys through GitHub Actions into release directories

## Quick Start

```bash
git clone https://github.com/ussi69-dotcom/deckterm.git
cd deckterm
bun install
bun run dev
```

By default the backend starts on `4174` unless `PORT` overrides it.

## Core Features

### Terminal and workspace UX

- Up to 10 concurrent terminals by default
- New workspace tabs and split terminals inside a workspace
- Drag one workspace tab onto another to merge them
- Actions palette for cross-workspace navigation and quick actions via `Ctrl+Shift+P`
- Search, font scaling, fullscreen, line wrap toggle, reconnect lifecycle overlay
- Linked view for tmux-backed sessions

### Mobile workflow

- Extra keys bar with modifiers, arrows, navigation keys, and F-keys
- Focus recovery when switching back to the active terminal
- Clipboard image upload and touch paste fallback
- Layout fixes for narrow screens, virtual keyboards, and viewport shifts

### Clipboard and files

- OSC52 clipboard capture
- Clipboard history panel
- Large-paste warning flow
- File browser and file manager under allowed filesystem roots

### Git workflow

- Git status, diff, stage, unstage, commit, branch listing, checkout, log, and show
- Git panel intended for lightweight terminal-adjacent operations, including mobile use

### Agent-aware signals

- Workspace tabs detect running processes
- Codex and Claude sessions can surface `Codex` / `Codex Responding` style labels
- Port and worktree hints are also surfaced in workspace metadata

## Security and Access

DeckTerm supports Cloudflare Access JWT validation and trusted origins. Production should be treated as a protected internal tool, not a public terminal exposed directly to the internet.

Relevant variables include:

- `CF_ACCESS_REQUIRED`
- `CF_ACCESS_TEAM_NAME`
- `CF_ACCESS_AUD`
- `TRUSTED_ORIGINS`
- `ALLOWED_FILE_ROOTS`

## Configuration

Common runtime variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4174` | HTTP server port |
| `HOST` | `0.0.0.0` | Bind address |
| `OPENCODE_WEB_DEBUG` | `0` | Debug logging |
| `OPENCODE_WEB_MAX_TERMINALS` | `10` | Global terminal cap |
| `MAX_TERMINALS_PER_USER` | `10` | Per-user cap |
| `TERMINAL_IDLE_TIMEOUT_MS` | `7200000` | Idle terminal cleanup |
| `SCROLLBACK_MAX_LINES` | `2000` | Reconnect replay line budget |
| `SCROLLBACK_MAX_BYTES` | `1048576` | Reconnect replay byte budget |
| `AGENT_RESPONDING_IDLE_MS` | `700` | Response-to-idle decay for agent badges |
| `ALLOWED_FILE_ROOTS` | `$HOME` | Allowed browse/upload/git roots |
| `TMUX_BACKEND` | `1` in deployed environments | Persistent tmux sessions |

Legacy compatibility note:

- The backend still contains OpenCode proxy routes, but OpenCode is no longer part of the active DeckTerm UI and is not documented as a primary workflow.

## Development Workflow

Branch model:

- `feature/*` for scoped work
- `dev` as integration branch
- `main` as production branch

Promotion model:

1. Build on `feature/*` or directly on `dev`
2. Validate on `4174`
3. Promote to `main`
4. Let `Deploy Main` verify, package, and atomically deploy production

## Testing

```bash
bun run test:unit
bun run test:e2e:smoke
bun run test:e2e:workspace
bun run test:e2e
```

Project rule: browser tests target the dev environment on `4174`.

## Docs

- Product guide: [docs/product-guide.md](/home/deploy/deckterm_dev/docs/product-guide.md)
- Operations and CI/CD: [docs/operations-guide.md](/home/deploy/deckterm_dev/docs/operations-guide.md)
- Deploy layout and rollback: [deploy/README.md](/home/deploy/deckterm_dev/deploy/README.md)

## Tech Stack

- Runtime: Bun
- Backend: Hono + Bun WebSocket + Bun.Terminal
- Frontend: Vanilla JS + xterm.js
- Persistence: tmux
- Auth: optional Cloudflare Access JWT validation

## License

MIT
