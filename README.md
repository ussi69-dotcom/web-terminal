# Web Terminal

A remote web-based terminal with full PTY support, floating/tiling window manager, and mobile-friendly UI.

![Bun](https://img.shields.io/badge/Bun-1.3.5+-black?logo=bun)
![Hono](https://img.shields.io/badge/Hono-4.x-orange)
![xterm.js](https://img.shields.io/badge/xterm.js-5.x-green)

## Features

- **Full PTY Support** - Native terminal emulation with resize (SIGWINCH), colors, and cursor positioning
- **Floating Tiling Windows** - Drag, resize, snap, and tile multiple terminal windows
- **Multi-Terminal** - Up to 10 concurrent terminal sessions
- **Auto-Reconnect** - WebSocket reconnection with exponential backoff
- **Mobile Support** - Touch-friendly with extra keys bar (ESC, TAB, CTRL, ALT, SHIFT, arrows, F1-F12)
- **File Manager** - Browse, upload, download, and manage files
- **Server Stats** - Real-time CPU, RAM, and disk usage monitoring
- **Session Persistence** - Reconnect to existing terminals on page reload

## Requirements

- **Bun 1.3.5+** (required for `Bun.Terminal` PTY API)

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd web-terminal
bun install

# Start server
bun run dev

# Open in browser
open http://localhost:4173
```

## Configuration

Create a `.env` file or set environment variables:

| Variable                     | Default | Description                   |
| ---------------------------- | ------- | ----------------------------- |
| `PORT`                       | 4173    | Server port                   |
| `HOST`                       | 0.0.0.0 | Bind address                  |
| `OPENCODE_WEB_DEBUG`         | 0       | Enable debug logging (1 = on) |
| `OPENCODE_WEB_MAX_TERMINALS` | 10      | Maximum concurrent terminals  |

## Keyboard Shortcuts

### Terminal Management

| Shortcut       | Action                         |
| -------------- | ------------------------------ |
| `Ctrl+N`       | New terminal (new workspace)   |
| `Ctrl+W`       | Close current workspace        |
| `Ctrl+Tab`     | Switch to next tab             |
| `Ctrl+1-9`     | Switch to tab by number        |
| `Ctrl+Shift+D` | Split workspace (add terminal) |

### Window Management

| Shortcut        | Action                       |
| --------------- | ---------------------------- |
| `Ctrl+G`        | Group with previous terminal |
| `Ctrl+Shift+G`  | Ungroup current terminal     |
| `Ctrl+Z`        | Undo layout change           |
| Drag tile edge  | Resize terminals             |
| Drag tab to tab | Merge workspaces             |

### General

| Shortcut            | Action                      |
| ------------------- | --------------------------- |
| `Ctrl+F`            | Search in terminal          |
| `Ctrl++` / `Ctrl+-` | Increase/decrease font size |
| `F11`               | Toggle fullscreen           |
| `F1` or `?`         | Show help                   |

## Extra Keys Bar (Mobile)

The bottom bar provides touch-friendly access to special keys:

**Row 1:** ESC, TAB, CTRL, ALT, SHIFT, arrows, HOME, END, INS, DEL

**Row 2 (toggle with ⋯):** F1-F12, PgUp, PgDn

## API Reference

### Terminals

```bash
# Create terminal
POST /api/terminals
Content-Type: application/json
{"cwd": "/home/user", "cols": 120, "rows": 30}

# List terminals
GET /api/terminals

# Delete terminal
DELETE /api/terminals/:id

# Resize terminal
POST /api/terminals/:id/resize
{"cols": 120, "rows": 30}

# WebSocket connection
WS /ws/terminals/:id
```

### Files

```bash
# Browse directory
GET /api/browse?path=/home/user

# Download file
GET /api/files/download?path=/home/user/file.txt

# Upload file
POST /api/files/upload?path=/home/user
Content-Type: multipart/form-data

# Create directory
POST /api/files/mkdir?path=/home/user/newdir

# Delete file/directory
DELETE /api/files?path=/home/user/file.txt

# Rename
POST /api/files/rename
{"from": "/old/path", "to": "/new/path"}
```

### Health & Stats

```bash
# Server health
GET /api/health
# Response: {"status":"ok","terminals":2,"maxTerminals":10,"uptime":123.45}

# Server stats
GET /api/stats
# Response: {"cpu":{"usage":5},"memory":{"percent":68},"disk":{"percent":27}}
```

## WebSocket Protocol

### Client to Server

```typescript
// Send terminal input
{ type: "input", data: "ls -la\n" }

// Resize terminal
{ type: "resize", cols: 120, rows: 30 }

// Heartbeat ping
{ type: "ping" }
```

### Server to Client

```typescript
// Heartbeat response
{ type: "pong" }

// Terminal exited
{ type: "exit", code: 0 }

// Terminal output (raw string, not JSON)
"total 42\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .\n"
```

## Project Structure

```
web-terminal/
├── backend/
│   ├── index.ts          # Entry point
│   └── server.ts         # Hono server + PTY management
├── web/
│   ├── app.js            # Frontend (TileManager, TerminalManager)
│   ├── index.html        # UI structure
│   ├── styles.css        # GitHub dark theme
│   ├── presets.json      # Command presets
│   └── vendor/           # xterm.js libraries
├── .env                  # Configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) 1.3.5+ with native PTY support
- **Backend**: [Hono](https://hono.dev/) - Fast, lightweight web framework
- **Frontend**: Vanilla JavaScript with [xterm.js](https://xtermjs.org/)
- **Styling**: Custom CSS with GitHub dark theme

## Development

```bash
# Run with debug logging
OPENCODE_WEB_DEBUG=1 bun run dev

# Check server health
curl http://localhost:4173/api/health

# Create terminal via API
curl -X POST http://localhost:4173/api/terminals \
  -H "Content-Type: application/json" \
  -d '{"cols": 80, "rows": 24}'
```

## Security Considerations

- Rate limiting: Max 20 terminal creations per minute
- Path validation: Invalid working directories fallback to HOME
- Protected paths: Cannot delete root or home directory
- CORS enabled for browser access

## Troubleshooting

### "Failed to create terminal"

- Ensure Bun 1.3.5+ is installed (`bun --version`)
- Check if working directory exists
- Verify terminal limit not reached (check `/api/health`)

### "Cannot read directory"

- Check file permissions
- Verify path exists

### Connection issues

- Hard refresh browser (`Ctrl+Shift+R`)
- Check server is running (`curl http://localhost:4173/api/health`)
- Verify firewall allows port 4173

## License

MIT
