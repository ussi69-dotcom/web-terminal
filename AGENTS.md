# Web Terminal

Remote web-based terminal with PTY sessions and floating tiling window manager.

## Structure

```
web-terminal/
├── backend/
│   ├── index.ts        # Entry point (8 lines)
│   └── server.ts       # Hono + Bun.Terminal PTY (584 lines)
├── web/
│   ├── app.js          # Tiling WM + xterm.js client (2381 lines)
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
bun run dev            # Start dev server
bun run start          # Production (same as dev)
# Default: http://localhost:4173
```

## Code Map

| Symbol                  | Location      | Role                                 |
| ----------------------- | ------------- | ------------------------------------ |
| `startWebServer()`      | server.ts:475 | Main entry, creates Bun.serve        |
| `createWebApp()`        | server.ts:74  | Hono routes factory                  |
| `BunTerminal`           | server.ts:20  | PTY wrapper (types not in bun-types) |
| `terminals` Map         | server.ts:48  | Active PTY sessions                  |
| `ReconnectingWebSocket` | app.js:56     | Auto-reconnect with heartbeat        |
| `TileManager`           | app.js:418    | Floating/tiling window manager       |
| `TerminalManager`       | app.js:1371   | Terminal lifecycle management        |
| `StatsManager`          | app.js:1320   | Server stats polling                 |

## API

| Endpoint                    | Method | Description                       |
| --------------------------- | ------ | --------------------------------- |
| `/api/health`               | GET    | Server status                     |
| `/api/stats`                | GET    | CPU/RAM/Disk usage                |
| `/api/terminals`            | GET    | List terminals                    |
| `/api/terminals`            | POST   | Create PTY `{cwd?, cols?, rows?}` |
| `/api/terminals/:id`        | DELETE | Kill terminal                     |
| `/api/terminals/:id/resize` | POST   | Resize PTY `{cols, rows}`         |
| `/ws/terminals/:id`         | WS     | Terminal I/O stream               |
| `/api/browse?path=`         | GET    | List directories                  |
| `/api/files/download?path=` | GET    | Download file                     |
| `/api/files/upload?path=`   | POST   | Upload to directory               |
| `/api/files/mkdir?path=`    | POST   | Create directory                  |
| `/api/files`                | DELETE | Delete file/directory             |
| `/api/files/rename`         | POST   | Rename `{from, to}`               |

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
| `PORT`                       | 4173    | Server port         |
| `HOST`                       | 0.0.0.0 | Bind address        |
| `OPENCODE_WEB_DEBUG`         | 0       | Debug logging       |
| `OPENCODE_WEB_MAX_TERMINALS` | 10      | Max concurrent PTYs |

## Where to Look

| Task                  | Location                                |
| --------------------- | --------------------------------------- |
| Add API endpoint      | server.ts (Hono routes in createWebApp) |
| Terminal spawn        | server.ts:171 (Bun.spawn with terminal) |
| UI/window management  | web/app.js (TileManager class)          |
| Styling               | web/styles.css                          |
| Add keyboard shortcut | web/app.js KEY_SEQUENCES                |
| Extra keys bar        | web/index.html (extra-keys div)         |

## Anti-Patterns

- Don't use Node PTY libs (use native `Bun.Terminal`)
- Don't skip rate limiting on `/api/terminals`
- Don't forget WebSocket cleanup on disconnect
- Don't hardcode paths (use env vars)
- Don't modify vendor/ files
- Don't remove CORS middleware (breaks browser requests)

## Conventions

- **Bun.Terminal API**: Not in bun-types yet, manually typed at server.ts:6-17
- **@ts-expect-error**: Only at server.ts:196 for terminal option
- **Static files**: Served from `./web` via Hono serveStatic
- **CWD validation**: Invalid paths fallback to HOME directory
