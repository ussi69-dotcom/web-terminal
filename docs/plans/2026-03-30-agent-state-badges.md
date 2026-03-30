# Agent State Badges Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add agent-aware `Thinking` and `Responding` tab states for interactive `codex` and `claude` sessions in DeckTerm.

**Architecture:** Bash wrapper functions emit explicit agent start/done markers. Backend telemetry parses those markers, classifies PTY output while an agent is active, and returns agent state to the frontend. Frontend tab badges prioritize agent state over generic running state while preserving existing completion notifications and generic shell behavior.

**Tech Stack:** Bun, Hono, Bun.Terminal, vanilla JS, Playwright, Bun test

---

### Task 1: Add backend telemetry tests for agent markers

**Files:**
- Modify: `backend/telemetry.test.ts`
- Modify: `backend/telemetry.ts`

**Step 1: Write failing tests**
- Add tests for `agent;codex;start` and `agent;codex;done;0`
- Add tests for classifying Codex spinner/title output as `thinking`
- Add tests for classifying visible agent text as `responding`

**Step 2: Run test to verify it fails**
- Run: `bun test ./backend/telemetry.test.ts`

**Step 3: Write minimal implementation**
- Extend parser state and events for agent markers
- Add output classification helper

**Step 4: Run test to verify it passes**
- Run: `bun test ./backend/telemetry.test.ts`

**Step 5: Commit**
- Commit once backend telemetry tests and implementation are green

### Task 2: Expose agent state through terminal telemetry

**Files:**
- Modify: `backend/server.ts`
- Modify: `backend/telemetry.ts`

**Step 1: Write failing integration assertion**
- Extend existing workspace telemetry test expectations for optional `agentName` and `agentState`

**Step 2: Run test to verify it fails**
- Run: `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts --grep "agent"`

**Step 3: Write minimal implementation**
- Add bash wrapper functions for `codex` and `claude`
- Track agent state on terminals
- Include agent state in `/api/terminals` and websocket `terminal_state`

**Step 4: Run test to verify it passes**
- Run the same test command

**Step 5: Commit**
- Commit when telemetry contract is green

### Task 3: Render agent badge states in the frontend

**Files:**
- Modify: `web/terminal-colors.js`
- Modify: `web/terminal-colors.test.js`
- Modify: `web/app.js`
- Modify: `web/styles.css`

**Step 1: Write failing tests**
- Add terminal-colors tests for `Codex Thinking` and `Claude Responding`
- Add e2e badge test that injects agent telemetry and checks tab label

**Step 2: Run tests to verify they fail**
- Run: `bun test ./web/terminal-colors.test.js`
- Run: `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts --grep "agent"`

**Step 3: Write minimal implementation**
- Add agent-aware signal descriptors and styles
- Update runtime state handling and tooltip content

**Step 4: Run tests to verify they pass**
- Re-run both commands

**Step 5: Commit**
- Commit when UI tests are green

### Task 4: Verify end-to-end on the live dev server

**Files:**
- Modify: `tests/workspace-signals.spec.ts`

**Step 1: Add failing end-to-end test**
- Simulate agent markers and output through the terminal and assert badge transitions

**Step 2: Run test to verify it fails**
- Run: `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts --grep "agent"`

**Step 3: Write minimal implementation**
- Fix any remaining parser/frontend gaps

**Step 4: Run verification**
- Run: `bun run test:unit`
- Run: `bun test ./backend/telemetry.test.ts`
- Run: `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts reconnect-tab-status.spec.ts phase3-clipboard.spec.ts mobile-regressions.spec.ts --workers=1 --reporter=line`

**Step 5: Commit**
- Commit final verified state
