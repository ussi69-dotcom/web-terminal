# Compact Navigation Surface Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zjednodušit horní navigační plochu DeckTermu, přesunout persistentní panely do sekundární vrstvy a doplnit několik high-value palette akcí bez backend redesignu.

**Architecture:** Implementace zůstane klientská. `web/index.html` a `web/styles.css` dostanou compact shell, desktop activity rail a mobile tools sheet; `web/app.js` napojí nové affordance na existující `FileManager`, `GitManager`, `ExtraKeysManager` a `TerminalManager` flow. Palette dostane jen akce, které už dnes mají spolehlivý runtime podklad.

**Tech Stack:** Bun, Vanilla JS, xterm.js, Playwright, Bun test.

---

### Task 1: Add Failing Coverage for the Compact Navigation Surface

**Files:**

- Create: `tests/navigation-surface.spec.ts`
- Modify: `tests/fixtures.ts`
- Modify: `package.json`

**Step 1: Write the failing desktop navigation spec**

Add a Playwright test that:

- opens `http://localhost:4174`
- waits for an active terminal
- asserts the old dense toolbar actions are no longer all visible in the top bar
- asserts a desktop activity rail is present

**Step 2: Write the failing mobile navigation spec**

Add a mobile viewport test that:

- opens DeckTerm
- taps the toolbar toggle
- expects a visible tools sheet
- expects files / clipboard / git entries inside that sheet

**Step 3: Add parity action assertions**

Extend the spec to cover:

- rail click opens `#git-panel`
- rail click opens `#file-modal`
- palette action `New Folder Here...` creates a folder in current cwd
- palette branch provider can switch to another branch in a fixture repo

**Step 4: Run the single spec and confirm failure**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because the new shell and parity actions do not exist yet.

**Step 5: Add a dedicated script**

Update `package.json` with a new entry such as:

```json
"test:e2e:navigation-surface": "cd tests && PW_BASE_URL=${PW_BASE_URL:-http://localhost:4174} npx playwright test navigation-surface.spec.ts --workers=1 --reporter=line"
```

**Step 6: Commit**

```bash
git add tests/navigation-surface.spec.ts tests/fixtures.ts package.json
git commit -m "test(navigation): add compact surface coverage"
```

### Task 2: Add the Compact Shell Markup

**Files:**

- Modify: `web/index.html`
- Modify: `web/styles.css`

**Step 1: Add desktop activity rail markup**

In `web/index.html`, add a desktop-only surface near the app shell with stable IDs for:

- files
- clipboard
- git

Use explicit button IDs so tests do not depend on icon structure.

**Step 2: Add mobile tools sheet markup**

Create a hidden mobile sheet container that can host:

- cwd input + browse
- linked view affordance
- files / clipboard / git shortcuts
- utility actions like extra keys, wrap, fullscreen, help

**Step 3: Remove redundant top-bar buttons from the primary surface**

Keep the header focused on:

- new workspace
- tabs
- connection state
- cwd input + browse
- linked view
- command palette trigger

**Step 4: Add compact shell CSS**

In `web/styles.css`, implement:

- tighter toolbar spacing
- activity rail placement on desktop
- hidden rail on mobile
- tools sheet presentation on mobile
- safe-area-aware padding and hit targets

**Step 5: Run the spec and confirm partial progress**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
```

Expected: shell rendering assertions improve, action wiring assertions still fail.

**Step 6: Commit**

```bash
git add web/index.html web/styles.css
git commit -m "feat(navigation): add compact shell surfaces"
```

### Task 3: Wire the Desktop Rail and Mobile Tools Sheet

**Files:**

- Modify: `web/app.js`
- Test: `tests/navigation-surface.spec.ts`

**Step 1: Add tools-sheet state handling**

In `web/app.js`, wire `toolbar-toggle` so mobile opens and closes the tools sheet instead of simply exposing the old second row.

**Step 2: Wire rail buttons to existing managers**

Connect:

- files rail button -> `this.fileManager.open()`
- clipboard rail button -> existing clipboard panel flow
- git rail button -> existing git panel flow

**Step 3: Reuse the same action handlers for mobile sheet items**

Do not fork behavior. The desktop rail and mobile sheet should call the same manager methods.

**Step 4: Preserve contextual linked view behavior**

Ensure linked view remains visible only when the current terminal session supports it.

**Step 5: Run tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
```

Expected: panel-surface assertions pass; parity action tests still fail.

**Step 6: Commit**

```bash
git add web/app.js tests/navigation-surface.spec.ts
git commit -m "feat(navigation): wire compact shell actions"
```

### Task 4: Move Low-Frequency Utility Actions Out of the Primary Toolbar

**Files:**

- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Test: `tests/navigation-surface.spec.ts`

**Step 1: Remove duplicate utility buttons from the top bar**

Move these out of the primary toolbar:

- copy
- paste
- font decrease
- font increase
- wrap
- fullscreen
- help

**Step 2: Keep them reachable through the existing action model**

Expose them via:

- command palette on desktop and mobile
- tools sheet on mobile where appropriate

**Step 3: Keep stats unobtrusive**

Either keep the existing server stats cluster compact or move it into the secondary tools area, but do not let it dominate the primary shell.

**Step 4: Refresh assertions**

Update E2E expectations so they verify the new primary-vs-secondary action split instead of raw button counts.

**Step 5: Run tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
```

Expected: desktop and mobile shell behavior passes, palette parity still pending.

**Step 6: Commit**

```bash
git add web/index.html web/app.js web/styles.css tests/navigation-surface.spec.ts
git commit -m "refactor(navigation): simplify primary toolbar surface"
```

### Task 5: Add High-Value Palette Parity Actions

**Files:**

- Modify: `web/app.js`
- Modify: `web/action-registry.js`
- Modify: `tests/fixtures.ts`
- Modify: `tests/navigation-surface.spec.ts`
- Create: `web/navigation-surface.test.js`
- Modify: `package.json`

**Step 1: Write failing unit coverage for the new actions**

Add tests for:

- `New Folder Here...` visibility and handler wiring
- git branch provider visibility only when cwd is a repo
- branch results excluding the current branch

**Step 2: Implement `New Folder Here...`**

Use the existing current directory and existing `/api/files/mkdir` flow. Keep the action prompt-based for MVP.

**Step 3: Implement branch results provider**

Use the existing git branches endpoint and checkout flow to:

- fetch branch list for current cwd
- expose branch actions in the palette
- switch branch directly on selection

**Step 4: Keep YAGNI on rename**

Do not implement rename in this task. Leave a short code comment or plan note if needed, but keep MVP limited to actions with clean existing runtime support.

**Step 5: Run unit and E2E tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/action-registry.test.js ./web/navigation-surface.test.js
bun run test:e2e:navigation-surface
```

Expected: PASS.

**Step 6: Commit**

```bash
git add web/app.js web/action-registry.js web/navigation-surface.test.js tests/fixtures.ts tests/navigation-surface.spec.ts package.json
git commit -m "feat(navigation): add compact shell palette parity"
```

### Task 6: Refresh Product Docs and Run Regression Slice

**Files:**

- Modify: `README.md`
- Modify: `docs/product-guide.md`
- Modify: `web/index.html`

**Step 1: Update product copy**

Document:

- compact primary shell
- desktop activity rail
- mobile tools sheet
- palette branch switching and folder creation

**Step 2: Update help text**

Make sure the help modal reflects the new access model and does not imply removed primary-toolbar buttons still exist.

**Step 3: Run the regression slice**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:unit
bun run test:e2e:navigation
bun run test:e2e:navigation-surface
bun run test:e2e:workspace
```

Expected: PASS.

**Step 4: Manual verification**

Check on `http://localhost:4174`:

- desktop shell feels lighter than the current two-row icon strip
- git/files/clipboard are reachable in one click from the rail
- mobile toggle opens a usable tools sheet
- palette still feels like the canonical action entry point

**Step 5: Commit**

```bash
git add README.md docs/product-guide.md web/index.html
git commit -m "docs(navigation): document compact shell"
```
