# DeckTerm VSCode-Like Git + Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Přiblížit Git UX k VS Code (průzkumník změn), odstranit problémy se scalingem/taby/reconnectem a zároveň zapracovat bezpečnostní a DX doporučení z předchozího auditu.

**Architecture:** Implementace poběží ve 4 proudech: (1) Git panel UX + API, (2) layout/scaling/tab reliability, (3) reconnect persistence, (4) security + test pipeline. Každý proud začne testy (Playwright/API smoke), potom minimální implementací, následně refactor. Změny v `web/app.js` budou postupně extrahovány do menších modulů bez velkého big-bang přepisu.

**Tech Stack:** Bun 1.3.x, Hono, Bun.Terminal PTY, Vanilla JS + xterm.js, Playwright.

---

## Scope & Non-Goals

- In scope:
  - VSCode-like Git explorer (sekce, strom souborů, rychlý diff workflow)
  - Oprava nedostupné části okna / špatného scalingu
  - Spolehlivé přepínání tabů
  - Reconnect se zachováním předchozího výstupu
  - Security hardening file API + CORS + WS proxy auth
  - Stabilizace test workflow
- Out of scope (teď):
  - Full hunk-level stage/unstage engine ve stylu VS Code internals
  - Kompletní přepis frontendu do frameworku

---

### Task 1: Baseline Repro + Guardrail Tests

**Files:**
- Create: `tests/git-vscode-explorer.spec.ts`
- Create: `tests/layout-bounds-scaling.spec.ts`
- Create: `tests/tab-switch-reliability.spec.ts`
- Create: `tests/reconnect-scrollback.spec.ts`
- Modify: `tests/fixtures.ts`

**Step 1: Write failing E2E tests (new user complaints + expected UX)**
- Git: assert sections `Staged Changes` + `Changes`, file tree grouping by folders, click file opens diff.
- Scaling: assert active tile never has negative left/top and is fully reachable.
- Tabs: assert click on full tab area switches on first click.
- Reconnect: assert output before reconnect remains visible after reconnect.

**Step 2: Run tests to verify fail**
Run:
```bash
cd /home/deploy/deckterm/tests
npx playwright test git-vscode-explorer.spec.ts layout-bounds-scaling.spec.ts tab-switch-reliability.spec.ts reconnect-scrollback.spec.ts
```
Expected: FAIL on missing behavior.

**Step 3: Commit baseline tests**
```bash
git add tests/*.spec.ts tests/fixtures.ts
git commit -m "test: add failing coverage for git explorer layout tabs reconnect"
```

---

### Task 2: Git API Enhancements for Explorer/Diff Modes

**Files:**
- Modify: `backend/server.ts`
- Test: `test-git-api.sh`

**Step 1: Add richer git status response**
- Extend `/api/git/status` payload with normalized fields per file:
  - `path`, `stagedStatus`, `unstagedStatus`, `isRenamed`, `oldPath?`, `section`.
- Keep backward compatibility (`status` field preserved).

**Step 2: Fix/extend `/api/git/diff` query semantics**
- Support:
  - unstaged file diff (current)
  - staged diff (`?staged=1`)
  - commit diff (`?commit=<hash>`)
- Reject incompatible query combinations with 400.

**Step 3: Verify API**
Run:
```bash
./test-git-api.sh
curl -s "http://localhost:4174/api/git/diff?cwd=/home/deploy/deckterm&commit=HEAD~1"
```
Expected: valid JSON with non-empty `diff` or explicit clean response.

**Step 4: Commit**
```bash
git add backend/server.ts test-git-api.sh
git commit -m "feat(git-api): add structured status and diff modes"
```

---

### Task 3: VSCode-Like Git Explorer UI

**Files:**
- Modify: `web/app.js` (GitManager block)
- Modify: `web/styles.css`
- Optionally Create (if extracting): `web/git-manager.js`
- Test: `tests/git-vscode-explorer.spec.ts`

**Step 1: Replace flat file list with explorer model**
- Build in-memory tree from paths.
- Render sections:
  - `Staged Changes`
  - `Changes`
- Render folder nodes collapsible, file nodes selectable.

**Step 2: Improve file row affordances**
- VSCode-like badges/icons for `M/A/D/U` and staged marker.
- Single-click selects, Enter opens diff, Space stage/unstage (keep keyboard shortcuts).

**Step 3: Diff panel behavior**
- Add toggle `Working Tree / Staged / Commit` where applicable.
- Persist last selected file + mode during refresh.

**Step 4: Validate with Playwright**
Run:
```bash
cd tests
npx playwright test git-vscode-explorer.spec.ts
```
Expected: PASS.

**Step 5: Commit**
```bash
git add web/app.js web/styles.css web/git-manager.js tests/git-vscode-explorer.spec.ts
git commit -m "feat(git): implement vscode-like explorer and diff workflow"
```

---

### Task 4: Layout Bounds, Scaling, and Reachability Fixes

**Files:**
- Modify: `web/app.js` (`Tile`, `TileManager`, `TerminalManager.syncTerminalSize`)
- Modify: `web/styles.css`
- Test: `tests/layout-bounds-scaling.spec.ts`

**Step 1: Clamp tile bounds to container**
- Ensure `x>=0`, `y>=0`, `x+width<=100`, `y+height<=100` in resize pipeline.
- Apply clamp in one shared helper used by all layout operations.

**Step 2: Prevent off-screen/unreachable tiles after resize/split/merge**
- After relayout and manual resize, auto-normalize all tiles.
- On activate, ensure tile is scrolled into visible area.

**Step 3: Fix terminal scaling policy**
- Remove/relax `preferredCols` growth behavior that can preserve over-wide layout.
- Fit by current container dimensions and sync resize immediately.

**Step 4: CSS adjustments**
- Revisit `min-width/min-height` logic on `.tile` for small viewports.
- Keep readability minimums but never allow unreachable content.

**Step 5: Verify**
Run:
```bash
cd tests
npx playwright test layout-bounds-scaling.spec.ts dimension-overlay.spec.ts size-warning.spec.ts
```
Expected: PASS.

**Step 6: Commit**
```bash
git add web/app.js web/styles.css tests/layout-bounds-scaling.spec.ts
git commit -m "fix(layout): clamp tile bounds and improve resize scaling"
```

---

### Task 5: Reliable Tab Switching (One-Click)

**Files:**
- Modify: `web/app.js` (`addTab`, workspace activation model)
- Modify: `web/styles.css`
- Test: `tests/tab-switch-reliability.spec.ts`

**Step 1: Make full tab clickable**
- Attach switch handler to whole `.tab` except close button.
- Keep drag-and-drop with movement threshold so click is not swallowed by drag.

**Step 2: Workspace-level activation consistency**
- Track `workspaceId -> lastActiveTerminalId`.
- Clicking tab switches reliably even when first terminal in workspace changed/closed.

**Step 3: Verify**
Run:
```bash
cd tests
npx playwright test tab-switch-reliability.spec.ts
```
Expected: PASS; no multi-click switching needed.

**Step 4: Commit**
```bash
git add web/app.js web/styles.css tests/tab-switch-reliability.spec.ts
git commit -m "fix(tabs): improve one-click switching and drag threshold"
```

---

### Task 6: Reconnect with Preserved Output (Without TMUX Dependency)

**Files:**
- Modify: `backend/server.ts`
- Modify: `web/app.js`
- Modify: `README.md`
- Test: `tests/reconnect-scrollback.spec.ts`

**Step 1: Add server-side scrollback ring buffer**
- For each terminal, keep bounded buffer (env-driven max bytes/lines).
- Append PTY output to buffer in data callback.

**Step 2: On WS reconnect send buffered output first**
- Detect reconnect robustněji než podle stáří session (e.g. prior socket count/history flag).
- Send replay frame before live stream continuation.

**Step 3: Keep tmux path compatible**
- If `TMUX_BACKEND=1`, prefer tmux capture.
- If disabled, use in-memory buffer fallback.

**Step 4: Verify**
Run:
```bash
cd tests
npx playwright test reconnect-scrollback.spec.ts reconnect-realistic.spec.ts reconnect-tab-status.spec.ts
```
Expected: PASS; previous output visible after reconnect.

**Step 5: Commit**
```bash
git add backend/server.ts web/app.js README.md tests/reconnect-scrollback.spec.ts
git commit -m "feat(reconnect): preserve terminal output across reconnect"
```

---

### Task 7: Security Hardening from Previous Audit

**Files:**
- Modify: `backend/server.ts`
- Modify: `README.md`
- Test: `test-git-api.sh` + manual curl checks

**Step 1: File API sandboxing**
- Apply realpath-based allowlist for file endpoints:
  - `/api/browse`
  - `/api/files/download`
  - `/api/files/upload`
  - `/api/files/mkdir`
  - `/api/files` delete
  - `/api/files/rename`
- Deny traversal/symlink escapes.

**Step 2: Tighten CORS/error exposure**
- No `credentials: true` with wildcard origin.
- Sanitize production error messages in responses.

**Step 3: Protect OpenCode WS proxy path**
- Enforce auth on `/apps/opencode/ws` equivalent to HTTP guard.

**Step 4: Verify**
Run:
```bash
./test-git-api.sh
curl -i "http://localhost:4174/api/files/download?path=/etc/passwd"
```
Expected: 403 for forbidden filesystem paths.

**Step 5: Commit**
```bash
git add backend/server.ts README.md test-git-api.sh
git commit -m "security: sandbox file api and harden ws/cors"
```

---

### Task 8: Debug/Noise Cleanup for Production Stability

**Files:**
- Modify: `web/app.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`

**Step 1: Gate temporary debug panel and verbose logs**
- Keep only behind explicit debug flag/build constant.
- Remove global `console.log` monkey-patch in normal mode.

**Step 2: Remove inline handlers in overlay/actions where feasible**
- Replace inline `onclick` with delegated listeners.

**Step 3: Verify no behavior regressions**
Run:
```bash
cd tests
npx playwright test debug-overlay.spec.ts terminal-basics.spec.ts
```
Expected: PASS.

**Step 4: Commit**
```bash
git add web/app.js web/index.html web/styles.css
git commit -m "refactor(debug): reduce runtime log noise and inline handlers"
```

---

### Task 9: Test Pipeline + Scripts Normalization

**Files:**
- Modify: `package.json`
- Modify: `tests/package.json`
- Modify: `README.md`

**Step 1: Make test commands deterministic from repo root**
- Add root scripts:
  - `test:unit`
  - `test:e2e`
  - `test:all`
- Ensure Playwright dependency is installed in known location.

**Step 2: Keep dev/prod port discipline**
- Explicitly run E2E against `http://localhost:4174`.

**Step 3: Verify scripts**
Run:
```bash
bun run test:unit
bun run test:e2e -- --grep "tab|reconnect|git"
```
Expected: scripts run without module resolution errors.

**Step 4: Commit**
```bash
git add package.json tests/package.json README.md
git commit -m "chore(test): normalize unit and e2e scripts"
```

---

### Task 10: Final Verification Gate + Handoff

**Files:**
- Modify: `docs/plans/2026-02-26-deckterm-vscode-git-stability.md` (checklist section)

**Step 1: Runtime checks**
Run:
```bash
env PORT=4174 bun run dev
./test-git-api.sh
cd tests && npx playwright test
```
Expected: server healthy, API checks pass, critical E2E green.

**Step 2: Manual UX checks (required)**
- Git panel: file explorer workflow feels VSCode-like.
- Resize/scroll: no unreachable area.
- Tabs: one-click switching.
- Reconnect: prior output preserved.

**Step 3: Integration summary**
- Record risks, deferred items, and rollback notes.

**Step 4: Final commit**
```bash
git add docs/plans/2026-02-26-deckterm-vscode-git-stability.md
git commit -m "docs(plan): finalize implementation and verification report"
```

---

## Execution Order Recommendation

1. Task 1 (tests first)
2. Tasks 2-6 (core user-visible fixes)
3. Task 7 (security hardening)
4. Tasks 8-9 (cleanup + DX)
5. Task 10 (full verification)

## Risk Register

- High: `web/app.js` monolith changes can create regressions across features.
- High: reconnect behavior differs with/without tmux backend.
- Medium: drag-vs-click tab handling can regress DnD merge UX.
- Medium: stricter file sandbox may break existing user workflows outside allowed roots.

## Rollback Plan

- Keep each task in isolated commit.
- If regressions appear, revert the specific task commit only.
- Preserve failing test as reproduction artifact before rollback.

