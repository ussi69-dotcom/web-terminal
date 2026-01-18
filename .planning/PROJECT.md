# DeckTerm - Major Refactor v2.0

> Web-based terminal emulator with tmux persistence, optimized for agent-driven development workflows on dedicated servers with Cloudflare tunnels.

## Vision

DeckTerm is a **multi-functional web terminal** designed for developers working on remote servers. The v2.0 refactor focuses on:

1. **Seamless session persistence** - close browser, reopen, same state
2. **Proper terminal scaling** - content fills the entire window
3. **Modern clipboard handling** - Ctrl+V paste, auto-copy on selection, image support
4. **Platform-aware UI** - desktop vs mobile optimizations

## Goals

### Primary

- **Fast session reconnection** - under 500ms to restore existing tmux session
- **Full-window terminal rendering** - no gaps, proper scaling on resize
- **Native clipboard experience** - Ctrl+V, selection auto-copy, image paste to Claude Code

### Secondary

- **Session lifecycle management** - auto-cleanup orphaned sessions
- **Platform-adaptive UI** - hide extra keys on desktop, show on mobile with virtual keyboard
- **Ghostty-inspired UX** - tab search, activity indicators, sensible defaults

## Non-Goals (Out of Scope for v2.0)

- GPU-accelerated rendering (WebGL) - overkill for current use case
- Kitty graphics protocol - nice-to-have but not priority
- Multi-user collaboration - single-user focus for now
- Native app wrapper - web-only

## Tech Stack

| Component           | Technology                | Notes                   |
| ------------------- | ------------------------- | ----------------------- |
| Runtime             | Bun 1.3.5+                | Native PTY API required |
| Backend             | Hono                      | Lightweight, fast       |
| Frontend            | Vanilla JS + xterm.js 5.x | No framework overhead   |
| Session Persistence | tmux                      | Server-side state       |
| Auth                | Cloudflare Access JWT     | Zero-trust              |

## Success Criteria

- [ ] Session reconnect < 500ms (measure with performance API)
- [ ] Terminal content fills 100% of tile area (no gaps)
- [ ] Ctrl+V pastes from system clipboard
- [ ] Selection auto-copies to clipboard (with visual feedback)
- [ ] Extra keys bar hidden on desktop, visible on mobile with virtual keyboard
- [ ] Orphaned sessions cleaned up within 30 minutes of window close
- [ ] All existing features remain functional (regression test)

## Key Pain Points Being Addressed

| Issue            | Current State             | Target State            |
| ---------------- | ------------------------- | ----------------------- |
| Slow reconnect   | 2-5 seconds               | < 500ms                 |
| Content gaps     | Empty space below content | Full window coverage    |
| Clipboard paste  | Right-click menu only     | Ctrl+V works            |
| Selection copy   | Manual button             | Auto-copy on select     |
| Extra keys on PC | Always visible            | Hidden on desktop       |
| Session cleanup  | Manual                    | Auto after window close |

## Research References

- **Codebase analysis**: `docs/research/2026-01-18-codebase-analysis.md`
- **Ghostty research**: `docs/research/2026-01-18-ghostty-comparison.md`
- **UI issues screenshot**: `/home/deploy/deckterm/deckterm_dev.jpg`

## Architecture Decisions

### AD-001: Tmux as Session Backend

- **Decision**: Keep tmux for session persistence
- **Rationale**: Already implemented, reliable, proven
- **Trade-off**: Adds complexity but provides robust session survival

### AD-002: Platform Detection Strategy

- **Decision**: Use `window.visualViewport` + touch detection + screen width
- **Rationale**: More reliable than user agent parsing
- **Implementation**: Show extra keys when virtual keyboard detected OR screen < 768px

### AD-003: Clipboard API Strategy

- **Decision**: Use Clipboard API with OSC52 fallback
- **Rationale**: Modern browsers support it, OSC52 for TUI tools
- **Security**: Clipboard confirmation for automated writes (Ghostty-inspired)
