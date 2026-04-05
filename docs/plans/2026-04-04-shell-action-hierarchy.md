# Shell Action Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Přestavět shell action hierarchy tak, aby `Files` a `Git` byly vždy přímo viditelné, mobil měl persistentní `Paste`, a command palette přestala být nutnou cestou pro základní workflow.

**Architecture:** Implementace zůstane čistě klientská. `web/index.html` a `web/styles.css` přeuspořádají shell do explicitních primary actions a overflow surface `More`; `web/app.js` a případně `web/navigation-surface.js` napojí nové affordance na existující Files, Git, Paste a utility flows bez backend změn. Testy se zaměří hlavně na novou action hierarchy na desktopu i mobilu.

**Tech Stack:** Bun, Vanilla JS, xterm.js, Playwright, Bun test.

---

### Task 1: Add Failing Coverage for the New Action Hierarchy

**Files:**
- Modify: `tests/navigation-surface.spec.ts`
- Modify: `tests/mobile-regressions.spec.ts`
- Modify: `tests/fixtures.ts`

**Step 1: Write the failing desktop hierarchy assertions**

Extend `tests/navigation-surface.spec.ts` so the desktop scenario expects:

- no visible `#activity-rail`
- explicit top-bar buttons for `Files`, `Git`, `Palette`, and `More`
- no requirement to open Files or Git through a rail

**Step 2: Write the failing mobile hierarchy assertions**

Add mobile expectations for:

- a persistent bottom action bar
- visible `Files`, `Git`, `Paste`, and `More`
- no need to open a giant tools sheet just to reach `Files` or `Git`

**Step 3: Add a regression assertion for mobile chrome density**

In `tests/mobile-regressions.spec.ts`, assert that:

- the top bar no longer carries the old overloaded utility cluster
- the primary actions live in the bottom bar instead

**Step 4: Run the targeted tests and confirm failure**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because the current shell still uses the floating activity rail and the old menu-driven mobile tools access.

**Step 5: Commit**

```bash
git add tests/navigation-surface.spec.ts tests/mobile-regressions.spec.ts tests/fixtures.ts
git commit -m "test(navigation): cover primary action hierarchy"
```

### Task 2: Add a Testable Action-Hierarchy Model

**Files:**
- Modify: `web/navigation-surface.js`
- Modify: `web/navigation-surface.test.js`

**Step 1: Write failing unit tests for primary vs overflow actions**

Add unit coverage for helpers that describe:

- desktop primary actions
- mobile primary actions
- overflow actions

The tests should explicitly verify:

- desktop primary excludes `Clipboard`
- mobile primary includes `Paste`
- overflow includes `Clipboard`, `Extra Keys`, `Wrap`, `Fullscreen`, `Font -`, `Font +`, `Help`, and `Linked view`

**Step 2: Implement minimal action-hierarchy helpers**

In `web/navigation-surface.js`, add small pure helpers that return action IDs or config objects for:

- desktop primary actions
- mobile primary actions
- overflow actions

Keep them data-only where possible so UI rendering and tests can share one source of truth.

**Step 3: Run the unit test and confirm it passes**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test web/navigation-surface.test.js
```

Expected: PASS with the new hierarchy helpers covered.

**Step 4: Commit**

```bash
git add web/navigation-surface.js web/navigation-surface.test.js
git commit -m "test(navigation): codify shell action hierarchy"
```

### Task 3: Replace the Desktop Rail with Explicit Top-Bar Primary Actions

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`

**Step 1: Remove the floating desktop activity rail markup**

Delete the current rail surface and its buttons from `web/index.html`.

**Step 2: Add a top-bar primary action cluster**

Add explicit desktop-visible buttons with stable IDs for:

- `Files`
- `Git`
- `Palette`
- `More`

Keep `New`, tabs, cwd, and status in the same shell, but do not bury `Files` or `Git` in a secondary rail.

**Step 3: Keep mobile top bar context-only**

Ensure the top bar on mobile is limited to contextual shell controls such as:

- `Menu`
- `New`
- tabs
- status

Do not reintroduce the old overloaded utility strip.

**Step 4: Update CSS for the new desktop hierarchy**

In `web/styles.css`, implement:

- inline top-bar action cluster styles
- removal of rail spacing assumptions
- reduced competition between actions and server stats

**Step 5: Run the desktop navigation spec**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
```

Expected: desktop hierarchy assertions improve; mobile bottom-bar assertions still fail.

**Step 6: Commit**

```bash
git add web/index.html web/styles.css
git commit -m "feat(navigation): move desktop primary actions into top bar"
```

### Task 4: Add the Mobile Bottom Action Bar and `More` Overflow Surface

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`

**Step 1: Add a mobile bottom action bar**

In `web/index.html`, add a dedicated mobile action bar with stable IDs for:

- `Files`
- `Git`
- `Paste`
- `More`

**Step 2: Replace the old tools sheet with a true overflow surface**

Reuse or rename the existing mobile tools surface so it behaves as `More`, not as the primary access point for Files or Git.

The overflow must host:

- `Clipboard`
- `Extra Keys`
- `Wrap`
- `Fullscreen`
- `Font -`
- `Font +`
- `Help`
- `Linked view`
- optionally mobile cwd editing

**Step 3: Wire primary actions to existing manager methods**

In `web/app.js`, connect:

- desktop `Files` -> existing file explorer open/close flow
- desktop `Git` -> existing git panel flow
- desktop `Palette` -> existing command palette controller
- mobile `Files` -> same file explorer flow
- mobile `Git` -> same git panel flow
- mobile `Paste` -> existing paste flow
- `More` -> overflow open/close state only

Do not fork separate behavior paths for desktop vs mobile when the underlying action is the same.

**Step 4: Hide low-frequency utilities from primary shell chrome**

Remove `Clipboard`, font controls, wrap, fullscreen, help, and linked-view utility clutter from the visible primary shell and keep them reachable via overflow or palette.

**Step 5: Run the targeted tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: PASS for the new desktop/mobile action hierarchy.

**Step 6: Commit**

```bash
git add web/index.html web/styles.css web/app.js
git commit -m "feat(navigation): add bottom-bar mobile actions and overflow"
```

### Task 5: Tune Mobile Density and CWD Placement

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Modify: `tests/size-warning.spec.ts`

**Step 1: Write the failing mobile size-warning expectation**

Update `tests/size-warning.spec.ts` or add a focused assertion so the mobile shell is checked under a narrow viewport with the new action layout.

At minimum, assert:

- the shell still exposes the bottom bar
- the top bar does not overflow with old utility controls

Do not overfit to exact pixel sizes; test the intended hierarchy.

**Step 2: Move mobile cwd editing out of the overloaded top bar**

Keep cwd editing directly visible on desktop, but move the mobile cwd edit affordance into `More` or a compact chip-based affordance so the top bar stops fighting for width.

**Step 3: Reduce top-bar density and preserve terminal space**

Adjust spacing and visibility rules so the mobile shell chrome is measurably lighter than today. Do not regress tab access or the `New` action.

**Step 4: Run the focused mobile specs**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test size-warning.spec.ts mobile-regressions.spec.ts navigation-surface.spec.ts --workers=1 --reporter=line
```

Expected: PASS with the new hierarchy and no dependency on the old crowded toolbar model.

**Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js tests/size-warning.spec.ts
git commit -m "refactor(navigation): reduce mobile shell density"
```

### Task 6: Update Docs and Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/product-guide.md`
- Modify: `web/index.html`

**Step 1: Update product documentation**

Refresh docs so they describe the new model:

- desktop top-bar primary actions
- mobile bottom action bar
- `More` overflow role
- command palette as advanced/discovery surface

Update the inline help copy in `web/index.html` if it still references the activity rail or the old mobile tools-first model.

**Step 2: Run unit tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:unit
```

Expected: PASS

**Step 3: Run the relevant end-to-end suites**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:navigation-surface
bun run test:e2e:file-explorer
bun run test:e2e:workspace
```

Expected: PASS

**Step 4: Do manual responsive visual QA**

Against `http://localhost:4174`, verify at least:

- desktop width around `1440px`
- mobile width around `393px`

Capture artifacts in `artifacts/visual-qa/` for:

- desktop home
- desktop files
- desktop git
- mobile home
- mobile files
- mobile more overflow

Confirm:

- `Files` and `Git` are visually primary
- mobile `Paste` is one tap away
- palette is no longer carrying basic navigation

**Step 5: Commit**

```bash
git add README.md docs/product-guide.md web/index.html
git commit -m "docs(navigation): document shell action hierarchy"
```
