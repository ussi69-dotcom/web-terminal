# CODEX.md

Codex-specific notes for DeckTerm. Base rules are in `AGENTS.md`.

## Environment
- Develop and test on port `4174` (dev).
- Do not run tests against port `4173` (production).

## Commands
```bash
bun install
bun run dev
./test-git-api.sh
curl http://localhost:4174/api/health
```

Service operations:
```bash
systemctl --user status deckterm-dev.service
systemctl --user restart deckterm-dev.service
journalctl --user -u deckterm-dev.service -f
```

## Verification
- Confirm server starts cleanly on `4174`.
- For backend/API changes, run `./test-git-api.sh`.
- For UI changes, verify terminal create/connect/resize/close flow in browser.

## Implementation Notes
- Keep `vendor/` untouched unless explicitly requested.
- Preserve Bun.Terminal-based PTY approach (no node-pty migration).
