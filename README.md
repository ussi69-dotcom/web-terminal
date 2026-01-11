# DeckTerm

A web-based terminal emulator with full PTY support, floating/tiling window manager, and mobile-friendly UI.

![Bun](https://img.shields.io/badge/Bun-1.3.5+-black?logo=bun)
![Hono](https://img.shields.io/badge/Hono-4.x-orange)
![xterm.js](https://img.shields.io/badge/xterm.js-5.x-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## Features

- **Full PTY Support** - Native terminal emulation with resize, colors, and cursor positioning
- **Tiling Window Manager** - Drag, resize, snap, and tile multiple terminal windows
- **Multi-Terminal** - Up to 10 concurrent terminal sessions
- **Auto-Reconnect** - WebSocket reconnection with exponential backoff
- **Mobile Support** - Touch-friendly extra keys bar (ESC, TAB, CTRL, ALT, SHIFT, arrows, F1-F12)
- **File Manager** - Browse, upload, download, and manage files
- **Server Stats** - Real-time CPU, RAM, and disk usage monitoring

## Requirements

- **Bun 1.3.5+** (required for native PTY API)

## Quick Start

```bash
git clone https://github.com/ussi69-dotcom/deckterm.git
cd deckterm
bun install
bun run dev
```

Open http://localhost:4173 in your browser.

## Configuration

| Variable                     | Default | Description              |
| ---------------------------- | ------- | ------------------------ |
| `PORT`                       | 4173    | Server port              |
| `HOST`                       | 0.0.0.0 | Bind address             |
| `OPENCODE_WEB_DEBUG`         | 0       | Enable debug logging     |
| `OPENCODE_WEB_MAX_TERMINALS` | 10      | Max concurrent terminals |

## Keyboard Shortcuts

| Shortcut          | Action                  |
| ----------------- | ----------------------- |
| `Ctrl+N`          | New terminal            |
| `Ctrl+W`          | Close terminal          |
| `Ctrl+Tab`        | Switch to next tab      |
| `Ctrl+1-9`        | Switch to tab by number |
| `Ctrl+Shift+D`    | Split workspace         |
| `Ctrl+G`          | Group terminals         |
| `Ctrl+F`          | Search in terminal      |
| `Ctrl++`/`Ctrl+-` | Adjust font size        |
| `F11`             | Toggle fullscreen       |

## Mobile Extra Keys

Bottom bar provides touch access to special keys:

- **Row 1:** ESC, TAB, CTRL, ALT, SHIFT, arrows, HOME, END, INS, DEL
- **Row 2:** F1-F12, PgUp, PgDn (toggle with ⋯)

## API

### Terminals

```bash
POST /api/terminals              # Create terminal
GET /api/terminals               # List terminals
DELETE /api/terminals/:id        # Delete terminal
POST /api/terminals/:id/resize   # Resize terminal
WS /ws/terminals/:id             # WebSocket connection
```

### Files

```bash
GET /api/browse?path=            # Browse directory
GET /api/files/download?path=    # Download file
POST /api/files/upload?path=     # Upload file
POST /api/files/mkdir?path=      # Create directory
DELETE /api/files?path=          # Delete file/directory
POST /api/files/rename           # Rename file
```

### Health

```bash
GET /api/health                  # Server status
GET /api/stats                   # CPU/RAM/Disk usage
```

## Project Structure

```
deckterm/
├── backend/
│   ├── index.ts        # Entry point
│   └── server.ts       # Hono server + PTY
├── web/
│   ├── app.js          # Frontend app
│   ├── index.html      # UI
│   ├── styles.css      # Styles
│   └── vendor/         # xterm.js
├── .env
└── package.json
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) with native PTY
- **Backend**: [Hono](https://hono.dev/)
- **Frontend**: Vanilla JS + [xterm.js](https://xtermjs.org/)

## License

MIT
