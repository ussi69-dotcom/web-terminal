# Phase 3 Context: Clipboard Overhaul

> Preferences captured on 2026-01-18

## Decisions Locked

| Area                   | Decision                            | Rationale                                                                     |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| Ctrl+V paste           | Warning for large content (>5KB)    | Shows preview dialog, protects against paste bombs                            |
| Auto-copy on selection | Opt-in preference (default: off)    | Respects user's clipboard, power users can enable in settings                 |
| Visual feedback        | Toast with debounce (max 1x per 2s) | Clear confirmation without spam during rapid copying                          |
| Image clipboard        | Full support (upload + path)        | Server-side upload, pass temp path to terminal for Claude Code                |
| OSC52 security         | Non-blocking notification           | Toast "Clipboard updated by terminal" - informs without interrupting workflow |

## Implementation Notes

### Ctrl+V Paste

- Intercept `Ctrl+V` / `Cmd+V` keydown on terminal
- Read from `navigator.clipboard.readText()`
- If content > 5KB: show modal with preview (first 500 chars) and byte count
- Modal buttons: "Paste anyway" / "Cancel"
- Handle permission denied: show paste button fallback

### Auto-Copy on Selection

- Add setting in preferences: "Auto-copy selection to clipboard" (default: false)
- Listen to xterm.js `onSelectionChange` event
- Debounce 300ms to avoid spam during mouse drag
- Only copy if setting enabled AND selection is non-empty

### Toast Feedback

- Reuse existing toast system
- Debounce: if toast shown within last 2 seconds, skip
- Message: "Copied to clipboard" (short, non-intrusive)

### Image Clipboard

- Detect `Ctrl+V` with image data via `clipboardData.types.includes('image/png')`
- Upload to server: `POST /api/clipboard/image`
- Server saves to temp dir, returns path: `/tmp/clipboard-{timestamp}.png`
- Send path to terminal as text (user can use in commands)
- Cleanup: server deletes temp images after 1 hour

### OSC52 Notification

- Keep existing OSC52 handler
- Add toast on successful clipboard write: "Clipboard updated by terminal"
- Same debounce as copy feedback (2s)

## Technical References

- Current ClipboardManager: `web/app.js` lines 1634-1830
- OSC52 handler: `web/app.js` lines 1696-1723
- Terminal keydown handlers: search for `keydown` in app.js
- Toast system: search for `showToast` in app.js

## Open Questions (for planning to research)

- Image upload endpoint security (auth, size limits, rate limiting)
- Temp image cleanup strategy (cron job vs on-demand)
- Should paste warning threshold be configurable?
- Bracketed paste mode - implement alongside or defer?

## Out of Scope for This Phase

- Multi-format paste (HTML, RTF)
- Clipboard history UI
- Cross-terminal clipboard sync
- Image paste directly into vim/other TUI apps
