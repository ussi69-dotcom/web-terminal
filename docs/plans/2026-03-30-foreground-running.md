# Foreground Running Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace heuristic `busy` workspace badges with real foreground `running/idle` state and surface a completion notification when a command finishes.

**Architecture:** Bash shell hooks emit PTY markers for command start and prompt return. The backend strips and parses these markers into terminal runtime state, exposes `running` via `/api/terminals`, and the client renders workspace signals plus a completion notification off `running -> idle`.

**Tech Stack:** Bun, Hono, Bun.Terminal, tmux/raw PTY backend, vanilla JS, Playwright, bun test.

---

### Task 1: Add failing telemetry tests for running markers

**Files:**
- Modify: `backend/telemetry.ts`
- Create: `backend/telemetry.test.ts`

**Step 1: Write the failing test**

Add tests that prove:
- a start marker sets `running: true`
- a prompt-return marker sets `running: false` and preserves an exit code
- marker text is stripped from extracted output

**Step 2: Run test to verify it fails**

Run: `bun test ./backend/telemetry.test.ts`
Expected: FAIL because telemetry has no running marker parser yet.

**Step 3: Write minimal implementation**

Implement marker parsing helpers in `backend/telemetry.ts` and expose `running` telemetry.

**Step 4: Run test to verify it passes**

Run: `bun test ./backend/telemetry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/telemetry.ts backend/telemetry.test.ts
git commit -m "feat(dev): add running marker telemetry"
```

### Task 2: Feed running state from backend PTY stream

**Files:**
- Modify: `backend/server.ts`

**Step 1: Write the failing test**

Extend telemetry tests or add a focused server-adjacent unit test to prove terminal state updates when scrollback chunks contain markers.

**Step 2: Run test to verify it fails**

Run: `bun test ./backend/telemetry.test.ts`
Expected: FAIL because server terminal state does not yet track running transitions.

**Step 3: Write minimal implementation**

Update PTY output handling to:
- strip markers before sending output to browser and scrollback
- store `running` and last completion metadata on the terminal
- expose `running` via `/api/terminals`

**Step 4: Run test to verify it passes**

Run: `bun test ./backend/telemetry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/server.ts backend/telemetry.ts backend/telemetry.test.ts
git commit -m "feat(dev): track foreground running state"
```

### Task 3: Render running badge instead of busy

**Files:**
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Modify: `web/terminal-colors.js`
- Modify: `web/terminal-colors.test.js`
- Modify: `tests/workspace-signals.spec.ts`

**Step 1: Write the failing test**

Change client/unit/e2e expectations from `Busy` to `Running` and add a transition back to no running badge after command completion.

**Step 2: Run test to verify it fails**

Run:
- `bun test ./web/terminal-colors.test.js`
- `cd tests && PW_BASE_URL=http://127.0.0.1:4181 npx playwright test workspace-signals.spec.ts --workers=1 --reporter=line`

Expected: FAIL because UI still renders `busy`.

**Step 3: Write minimal implementation**

Rename the workspace signal plumbing to `running`, update badge copy, priority wiring, and tab dataset fields.

**Step 4: Run test to verify it passes**

Run the same commands and expect PASS.

**Step 5: Commit**

```bash
git add web/app.js web/styles.css web/terminal-colors.js web/terminal-colors.test.js tests/workspace-signals.spec.ts
git commit -m "feat(dev): render running workspace signal"
```

### Task 4: Add completion notification

**Files:**
- Modify: `web/app.js`
- Modify: `tests/workspace-signals.spec.ts`

**Step 1: Write the failing test**

Add an e2e test with mocked `Notification` proving a notification is emitted when the active command finishes after previously entering `running`.

**Step 2: Run test to verify it fails**

Run: `cd tests && PW_BASE_URL=http://127.0.0.1:4181 npx playwright test workspace-signals.spec.ts --workers=1 --reporter=line`
Expected: FAIL because no completion notification exists.

**Step 3: Write minimal implementation**

Track previous `running` state in the client and fire a browser notification on `running -> idle` when permission is granted.

**Step 4: Run test to verify it passes**

Run the same Playwright command and expect PASS.

**Step 5: Commit**

```bash
git add web/app.js tests/workspace-signals.spec.ts
git commit -m "feat(dev): notify on command completion"
```

### Task 5: Final verification

**Files:**
- Modify: none unless fixes are needed

**Step 1: Run targeted verification**

Run:
- `bun test ./backend/telemetry.test.ts`
- `bun run test:unit`
- `cd tests && PW_BASE_URL=http://127.0.0.1:4181 npx playwright test workspace-signals.spec.ts mobile-regressions.spec.ts phase3-clipboard.spec.ts --workers=1 --reporter=line`

Expected: PASS

**Step 2: Commit final integration if needed**

```bash
git status --short
git commit -am "fix(dev): finalize running telemetry integration"
```
