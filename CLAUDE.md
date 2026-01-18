# CLAUDE.md - DeckTerm Development

## Environment

| Property        | Value                                           |
| --------------- | ----------------------------------------------- |
| **Environment** | Development                                     |
| **Port**        | 4174                                            |
| **URL**         | https://deckterm-dev.learnai.cz (if configured) |
| **Folder**      | `/home/deploy/deckterm_dev`                     |
| **Systemd**     | `systemctl --user status deckterm-dev.service`  |

## Related Environments

| Env             | Port | Folder                      | Purpose               |
| --------------- | ---- | --------------------------- | --------------------- |
| **Production**  | 4173 | `/home/deploy/deckterm`     | Stable, user-facing   |
| **Development** | 4174 | `/home/deploy/deckterm_dev` | Testing, new features |

## Critical Rules

1. **ALL tests MUST run against port 4174** - never 4173 (production)
2. **ALL development happens here** - not in production folder
3. **Playwright baseURL must be `http://localhost:4174`**
4. **Backend default port is 4174** (set in `backend/index.ts`)

## Commands

```bash
# Check status
systemctl --user status deckterm-dev.service

# Restart
systemctl --user restart deckterm-dev.service

# View logs
journalctl --user -u deckterm-dev.service -f

# Health check
curl http://localhost:4174/api/health

# Run tests (must be against 4174!)
cd tests && npx playwright test
```

## Test Configuration

**IMPORTANT:** All test files must use port 4174:

```typescript
// tests/playwright.config.ts
baseURL: "http://localhost:4174"; // NEVER 4173!

// In spec files
const APP_URL = "http://localhost:4174"; // NEVER 4173!
```

## Planning Files

- `.planning/PROJECT.md` - Project vision and goals
- `.planning/ROADMAP.md` - Implementation phases
- `.planning/STATE.md` - Current progress (update after each session)

## Workflow

1. Make changes in this folder (`deckterm_dev`)
2. Run tests: `cd tests && npx playwright test`
3. Verify on http://localhost:4174
4. Commit changes
5. Deploy to production (copy to `/home/deploy/deckterm`)

## Cloudflare Tunnel

- Subdomain: `deckterm-dev.learnai.cz` (configure in CF Zero Trust)
- Target: `http://localhost:4174`
