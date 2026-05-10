# Command Palette + Navigation Layer MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Přidat command palette jako jednotný vstup pro akce, panely a workspace switching bez backend změn v první fázi.

**Architecture:** Zavedeme malý klientský action registry a samostatný command palette UI modul, které se napojí na existující `TerminalManager`, `GitManager`, `FileManager` a další již hotové controllery. V první fázi ponecháme stávající toolbar, pouze přidáme palette affordance a action coverage, aby byl rollout nízkorizikový a dobře testovatelný.

**Tech Stack:** Bun, Vanilla JS, xterm.js, Playwright, Bun test.

---

### Task 1: Baseline Coverage for the Navigation Layer

**Files:**

- Create: `tests/command-palette.spec.ts`
- Modify: `tests/fixtures.ts`
- Modify: `package.json`

**Step 1: Write the failing E2E test for opening the palette**

In `tests/command-palette.spec.ts`, add a test that:

- loads `http://localhost:4174`
- waits for an active terminal
- presses `Control+Shift+P`
- expects a visible palette container and focused input

**Step 2: Run the single test to verify it fails**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because the palette UI does not exist yet.

**Step 3: Extend the spec with action execution assertions**

Add tests for:

- selecting `Open Git` opens `#git-panel`
- selecting `Open File Manager` opens `#file-modal`
- selecting a second workspace from palette activates the matching tab

**Step 4: Add a dedicated package script entry**

Update `/home/deploy/deckterm_dev/package.json` to include either:

- the new spec in an existing E2E script, or
- a new script such as `test:e2e:navigation`

**Step 5: Commit baseline coverage**

```bash
git add tests/command-palette.spec.ts tests/fixtures.ts package.json
git commit -m "test(navigation): add failing coverage for command palette"
```

### Task 2: Add the Palette Shell to the HTML and CSS

**Files:**

- Modify: `web/index.html`
- Modify: `web/styles.css`

**Step 1: Add palette markup to the HTML shell**

Insert a hidden overlay near the existing support surfaces in `web/index.html` with:

- root container `#command-palette`
- input `#command-palette-input`
- results container `#command-palette-results`
- empty state
- optional footer with shortcut hints

Also add one toolbar trigger button with a label like `Actions` or an icon-only affordance next to the existing row-2 tools.

**Step 2: Add desktop overlay styles**

In `web/styles.css`, create styles for:

- centered floating panel on desktop
- backdrop dim layer
- grouped result sections
- highlighted selected row
- metadata chips for workspace state

**Step 3: Add mobile sheet styles**

In `web/styles.css`, add responsive rules for narrow viewports so the same component renders as:

- bottom sheet or near-fullscreen sheet
- larger tap targets
- safe-area-aware padding

**Step 4: Verify that static shell renders without behavior**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run dev
```

Open `http://localhost:4174` and verify:

- no visible regression without opening the palette
- the new trigger button is present
- the hidden palette shell does not affect layout

**Step 5: Commit the shell**

```bash
git add web/index.html web/styles.css
git commit -m "feat(navigation): add command palette shell"
```

### Task 3: Introduce an Action Registry Module

**Files:**

- Create: `web/action-registry.js`
- Create: `web/action-registry.test.js`
- Modify: `package.json`
- Modify: `web/index.html`

**Step 1: Write the failing unit tests**

In `web/action-registry.test.js`, cover:

- registering static actions
- deduplicating by stable ID
- filtering by title and keywords
- grouping results by section
- sorting exact prefix matches above looser matches

**Step 2: Run the unit test to verify failure**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/action-registry.test.js
```

Expected: FAIL because the module does not exist yet.

**Step 3: Implement the minimal registry**

Create `web/action-registry.js` with:

- `ActionRegistry` class
- `register(action)`
- `registerProvider(provider)`
- `getResults(query, context)`

The result shape should include:

- `id`
- `title`
- `group`
- `keywords`
- `meta`
- `run`

**Step 4: Load the module in the page**

Add a script tag in `web/index.html` before `app.js` so `window.ActionRegistry` is available when `TerminalManager` initializes.

**Step 5: Add the new unit file to test scripts if needed**

Update `package.json` so the unit test is not orphaned.

**Step 6: Run unit tests and make sure they pass**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/action-registry.test.js
```

Expected: PASS.

**Step 7: Commit the registry**

```bash
git add web/action-registry.js web/action-registry.test.js web/index.html package.json
git commit -m "feat(navigation): add client action registry"
```

### Task 4: Build the Command Palette Controller

**Files:**

- Create: `web/command-palette.js`
- Create: `web/command-palette.test.js`
- Modify: `web/index.html`
- Modify: `package.json`

**Step 1: Write the failing unit tests**

In `web/command-palette.test.js`, cover:

- open / close state changes
- keyboard selection movement
- `Enter` executes the selected result callback
- `Escape` closes the palette
- empty query still shows high-priority defaults

**Step 2: Run the unit tests to verify failure**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/command-palette.test.js
```

Expected: FAIL because the controller module does not exist yet.

**Step 3: Implement the controller**

Create `web/command-palette.js` with:

- constructor receiving DOM refs and registry
- `open(context)`
- `close()`
- `toggle(context)`
- `setQuery(value)`
- `renderResults(results)`
- keyboard navigation helpers

Use a small public API on `window.CommandPaletteController`.

**Step 4: Load the controller before `app.js`**

Add the new script tag in `web/index.html` before the main app script.

**Step 5: Run the unit tests and make sure they pass**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/command-palette.test.js
```

Expected: PASS.

**Step 6: Commit the controller**

```bash
git add web/command-palette.js web/command-palette.test.js web/index.html package.json
git commit -m "feat(navigation): add command palette controller"
```

### Task 5: Integrate Palette Actions with Existing Managers

**Files:**

- Modify: `web/app.js`
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Test: `tests/command-palette.spec.ts`

**Step 1: Register static actions in `TerminalManager` startup**

In `web/app.js`, create palette actions for:

- New Terminal
- Split Workspace
- Open Git
- Open File Manager
- Open Clipboard
- Toggle Search
- Toggle Wrap
- Toggle Fullscreen
- Font Increase
- Font Decrease
- Help

Each action should delegate to an existing method rather than duplicating logic.

**Step 2: Add contextual actions**

Register actions that appear only when valid:

- Open Linked View
- Toggle Extra Keys

Guard them using existing runtime state, such as active terminal and tmux session availability.

**Step 3: Wire trigger button and keyboard shortcut**

In `web/app.js`, bind:

- toolbar trigger click
- `Ctrl+Shift+P`
- platform-safe equivalent handling for `Meta+Shift+P`

Prevent browser-default conflicts where needed and restore focus on close.

**Step 4: Run the E2E spec**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: partial PASS, with workspace switching still possibly failing until the next task.

**Step 5: Commit static action integration**

```bash
git add web/app.js web/index.html web/styles.css tests/command-palette.spec.ts
git commit -m "feat(navigation): wire palette actions to existing managers"
```

### Task 6: Add Workspace Provider and Result Metadata

**Files:**

- Modify: `web/app.js`
- Modify: `web/command-palette.js`
- Modify: `web/styles.css`
- Test: `tests/command-palette.spec.ts`

**Step 1: Expose workspace context for palette results**

Use existing workspace state from `TerminalManager` and tab metadata to build dynamic results containing:

- workspace label
- `workspaceId`
- active flag
- agent badge text
- running state
- ports
- worktree hint

**Step 2: Add workspace switch callbacks**

Each workspace result should call the same internal activation path as clicking a tab, not a parallel custom flow.

**Step 3: Render metadata chips in the result rows**

In `web/command-palette.js` and `web/styles.css`, show concise metadata such as:

- `Active`
- `Codex`
- `Running`
- `Ports 4173`
- `Worktree`

**Step 4: Run E2E again and make sure workspace switching passes**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: PASS for action launch and workspace switching.

**Step 5: Commit workspace results**

```bash
git add web/app.js web/command-palette.js web/styles.css tests/command-palette.spec.ts
git commit -m "feat(navigation): add workspace switching to command palette"
```

### Task 7: Verify Mobile Rendering and Focus Recovery

**Files:**

- Modify: `tests/command-palette.spec.ts`
- Optionally Modify: `tests/fixtures.ts`
- Modify: `web/styles.css`
- Modify: `web/app.js`

**Step 1: Add a mobile viewport test**

Extend `tests/command-palette.spec.ts` with a mobile test that:

- opens the app in a narrow viewport
- opens the palette
- verifies sheet-style rendering
- taps an action
- ensures the target panel opens

**Step 2: Add a focus recovery assertion**

After closing the palette with `Escape`, assert that:

- the active terminal remains usable
- no dead focus trap remains on the hidden overlay

**Step 3: Run the focused spec**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: PASS on both desktop and mobile cases.

**Step 4: Commit mobile polish**

```bash
git add tests/command-palette.spec.ts tests/fixtures.ts web/styles.css web/app.js
git commit -m "fix(navigation): verify mobile palette and focus recovery"
```

### Task 8: Document the New Navigation Layer and Validate Full Regression Surface

**Files:**

- Modify: `README.md`
- Modify: `docs/product-guide.md`
- Optionally Modify: `web/index.html`

**Step 1: Update product docs**

Add command palette to:

- core features in `README.md`
- primary UI inventory in `docs/product-guide.md`
- keyboard shortcuts help if the shortcut is user-facing

**Step 2: Run unit coverage**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/action-registry.test.js ./web/command-palette.test.js
```

Expected: PASS.

**Step 3: Run relevant existing regression suites**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:unit
```

Expected: PASS.

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts workspace-signals.spec.ts mobile-regressions.spec.ts git-panel.spec.ts --workers=1 --reporter=line
```

Expected: PASS on navigation and no obvious regressions in panels or mobile behavior.

**Step 4: Commit docs and verification**

```bash
git add README.md docs/product-guide.md web/index.html
git commit -m "docs(navigation): document command palette workflow"
```

### Follow-Up Phase: Compact Toolbar / Activity Rail

This plan intentionally stops after the palette foundation. If adoption is good, open a second design/plan for:

- reducing row-2 toolbar density
- moving low-frequency actions into overflow
- introducing a left or right activity rail on desktop
- removing redundant buttons only after the palette proves reliable
