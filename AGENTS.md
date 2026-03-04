# DeckTerm

Web-based terminal with PTY sessions and floating tiling window manager.

## Structure

```
deckterm/
├── backend/
│   ├── index.ts        # Entry point
│   └── server.ts       # Hono + Bun.Terminal PTY
├── web/
│   ├── app.js          # Tiling WM + xterm.js client
│   ├── index.html      # UI shell with modals
│   ├── styles.css      # GitHub dark theme
│   ├── presets.json    # Agent presets
│   └── vendor/         # xterm.js libs
├── .env                # PORT, DEBUG, MAX_TERMINALS
└── package.json        # bun + hono only
```

## Stack

- **Runtime**: Bun 1.3.5+ (required for `Bun.Terminal` PTY API)
- **Backend**: Hono (routing + CORS) + native Bun WebSocket
- **Frontend**: Vanilla JS + xterm.js

## Commands

```bash
bun install            # Install dependencies
bun run dev            # Start dev server (default: http://localhost:4174)
bun run start          # Production
```

## Environments

| Port | Purpose     | Folder                    | Systemd Service      |
| ---- | ----------- | ------------------------- | -------------------- |
| 4173 | Production  | /home/deploy/deckterm     | deckterm.service     |
| 4174 | Development | /home/deploy/deckterm_dev | deckterm-dev.service |

**IMPORTANT:** Tests must ALWAYS run against port 4174 (dev), NEVER 4173 (prod).

## Code Map

| Symbol                  | Location  | Role                           |
| ----------------------- | --------- | ------------------------------ |
| `startWebServer()`      | server.ts | Main entry, creates Bun.serve  |
| `createWebApp()`        | server.ts | Hono routes factory            |
| `BunTerminal`           | server.ts | PTY wrapper                    |
| `terminals` Map         | server.ts | Active PTY sessions            |
| `ReconnectingWebSocket` | app.js    | Auto-reconnect with heartbeat  |
| `TileManager`           | app.js    | Floating/tiling window manager |
| `TerminalManager`       | app.js    | Terminal lifecycle management  |
| `ExtraKeysManager`      | app.js    | Mobile extra keys handler      |

## API

| Endpoint                    | Method | Description         |
| --------------------------- | ------ | ------------------- |
| `/api/health`               | GET    | Server status       |
| `/api/stats`                | GET    | CPU/RAM/Disk usage  |
| `/api/terminals`            | GET    | List terminals      |
| `/api/terminals`            | POST   | Create PTY          |
| `/api/terminals/:id`        | DELETE | Kill terminal       |
| `/api/terminals/:id/resize` | POST   | Resize PTY          |
| `/ws/terminals/:id`         | WS     | Terminal I/O stream |
| `/api/browse?path=`         | GET    | List directories    |
| `/api/files/download?path=` | GET    | Download file       |
| `/api/files/upload?path=`   | POST   | Upload to directory |
| `/api/files/mkdir?path=`    | POST   | Create directory    |
| `/api/files`                | DELETE | Delete file         |
| `/api/files/rename`         | POST   | Rename file         |

## WebSocket Protocol

```typescript
// Client → Server
{ type: "input", data: "..." }     // Terminal input
{ type: "resize", cols, rows }     // Resize PTY
{ type: "ping" }                   // Heartbeat

// Server → Client
{ type: "pong" }                   // Heartbeat response
{ type: "exit", code }             // Terminal exited
raw string                         // PTY output
```

## Configuration (.env)

| Variable                     | Default | Description         |
| ---------------------------- | ------- | ------------------- |
| `PORT`                       | 4174    | Server port (dev)   |
| `HOST`                       | 0.0.0.0 | Bind address        |
| `OPENCODE_WEB_DEBUG`         | 0       | Debug logging       |
| `OPENCODE_WEB_MAX_TERMINALS` | 10      | Max concurrent PTYs |

## Where to Look

| Task                 | Location                                |
| -------------------- | --------------------------------------- |
| Add API endpoint     | server.ts (Hono routes in createWebApp) |
| Terminal spawn       | server.ts (Bun.spawn with terminal)     |
| UI/window management | web/app.js (TileManager class)          |
| Mobile extra keys    | web/app.js (ExtraKeysManager class)     |
| Styling              | web/styles.css                          |
| Keyboard shortcuts   | web/app.js KEY_SEQUENCES                |

## Anti-Patterns

- Don't use Node PTY libs (use native `Bun.Terminal`)
- Don't skip rate limiting on `/api/terminals`
- Don't forget WebSocket cleanup on disconnect
- Don't hardcode paths (use env vars)
- Don't modify vendor/ files
- Don't remove CORS middleware
