# File Explorer Sidebar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nahradit file manager modal workspace-aware files surface, která se na desktopu chová jako persistentní sidebar a na mobilu jako překryvný overlay.

**Architecture:** Implementace zavede `FileExplorerController` jako shared files surface se dvěma layout módy. `TerminalManager` bude koordinovat otevření a right-surface contract s gitem, zatímco samotný explorer controller bude držet per-workspace path state a file API operace. MVP zůstane bez backend změn a bez stromového exploreru.

**Tech Stack:** Bun, Vanilla JS, xterm.js, Playwright, Bun test.

---

### Task 1: Add Failing Coverage for the Unified Explorer Surface

**Files:**
- Create: `tests/file-explorer-surface.spec.ts`
- Modify: `tests/command-palette.spec.ts`
- Modify: `tests/navigation-surface.spec.ts`
- Modify: `tests/fixtures.ts`
- Modify: `package.json`

**Step 1: Write the failing desktop explorer spec**

Add a Playwright test that:

- opens DeckTerm on `http://localhost:4174`
- clicks the Files rail entry
- expects a visible docked explorer root such as `#file-explorer`
- asserts the old `#file-modal` is no longer the primary surface

**Step 2: Write the failing mobile explorer spec**

Add a mobile viewport test that:

- opens the tools sheet
- clicks the Files entry
- expects the explorer root to render as a full overlay

**Step 3: Add workspace-memory assertions**

Extend the spec so it:

- opens Files in workspace A
- navigates into a child folder
- switches to workspace B and opens a different path
- returns to workspace A
- expects the prior path to be restored

**Step 4: Add mutual-exclusion assertions**

Add coverage proving:

- opening Git hides Files
- opening Files hides Git

**Step 5: Update old file expectations**

Change existing tests that assert `#file-modal` visibility so they assert the new explorer root instead.

**Step 6: Run the focused spec and confirm failure**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test file-explorer-surface.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because the new explorer surface does not exist yet.

**Step 7: Add dedicated scripts**

Update `package.json` with entries such as:

```json
"test:e2e:file-explorer": "cd tests && PW_BASE_URL=${PW_BASE_URL:-http://localhost:4174} npx playwright test file-explorer-surface.spec.ts --workers=1 --reporter=line"
```

**Step 8: Commit**

```bash
git add tests/file-explorer-surface.spec.ts tests/command-palette.spec.ts tests/navigation-surface.spec.ts tests/fixtures.ts package.json
git commit -m "test(files): add explorer surface coverage"
```

### Task 2: Add the Explorer Surface Shell

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`

**Step 1: Add a new explorer root surface**

Create a new root such as `#file-explorer` with:

- header
- breadcrumb
- toolbar
- file list
- drop zone
- mobile close control

Keep the shell present in the DOM but hidden by default.

**Step 2: Add desktop docked styles**

Implement a desktop layout that:

- docks to the right side of the shell
- visually matches the compact navigation surfaces
- leaves terminal area usable while explorer is open

**Step 3: Add mobile overlay styles**

Implement a mobile layout that:

- becomes a full overlay
- covers the workspace
- supports backdrop and close affordance

**Step 4: Keep the legacy modal temporarily**

Do not delete the old modal markup in this step. Add the new surface first so behavior can be migrated incrementally.

**Step 5: Run the focused E2E spec**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:file-explorer
```

Expected: shell existence assertions improve, behavior tests still fail.

**Step 6: Commit**

```bash
git add web/index.html web/styles.css
git commit -m "feat(files): add explorer surface shell"
```

### Task 3: Extract a Workspace-Aware File Explorer Controller

**Files:**
- Create: `web/file-explorer.js`
- Create: `web/file-explorer.test.js`
- Modify: `web/index.html`
- Modify: `package.json`

**Step 1: Write failing unit tests**

Cover:

- opening chooses `docked` on desktop and `overlay` on mobile
- `currentPathByWorkspace` stores separate paths
- selecting an item is workspace-specific
- `openForWorkspace(workspaceId, cwd)` initializes from cwd when no prior path exists

**Step 2: Run the unit test to confirm failure**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/file-explorer.test.js
```

Expected: FAIL because the module does not exist.

**Step 3: Implement the controller**

Create `web/file-explorer.js` with:

- `FileExplorerController`
- shared explorer state
- `openForWorkspace(workspaceId, cwd, mode)`
- `close()`
- `setWorkspacePath(workspaceId, path)`
- `getWorkspacePath(workspaceId)`
- render hooks for breadcrumb, list, and loading/error state

**Step 4: Load the module before `app.js`**

Add a script tag in `web/index.html` before the main app script.

**Step 5: Add the unit test to `test:unit`**

Update `package.json` so the controller test runs with the normal unit suite.

**Step 6: Run unit tests and confirm pass**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test ./web/file-explorer.test.js
```

Expected: PASS.

**Step 7: Commit**

```bash
git add web/file-explorer.js web/file-explorer.test.js web/index.html package.json
git commit -m "feat(files): add workspace-aware explorer controller"
```

### Task 4: Wire the Explorer Into TerminalManager and Replace File Modal Entry Points

**Files:**
- Modify: `web/app.js`
- Modify: `tests/file-explorer-surface.spec.ts`
- Modify: `tests/command-palette.spec.ts`
- Modify: `tests/navigation-surface.spec.ts`

**Step 1: Instantiate the new controller**

Replace modal-oriented `FileManager` usage with the new `FileExplorerController`.

**Step 2: Add a right-surface contract**

Implement a small state contract in `TerminalManager`:

- `none`
- `files`
- `git`

Use it so Files and Git do not stay open together.

**Step 3: Rewire all Files entry points**

Make these open the new explorer surface:

- desktop activity rail
- mobile tools sheet
- command palette `Open File Manager`

**Step 4: Keep workspace context in sync**

On workspace switch:

- if explorer is open, update its content to the remembered path for that workspace
- if no path was remembered, initialize from active terminal cwd or directory input

**Step 5: Run focused E2E tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:file-explorer
bun run test:e2e:navigation
bun run test:e2e:navigation-surface
```

Expected: PASS or only file-operation assertions still pending.

**Step 6: Commit**

```bash
git add web/app.js tests/file-explorer-surface.spec.ts tests/command-palette.spec.ts tests/navigation-surface.spec.ts
git commit -m "feat(files): wire explorer surface into shell"
```

### Task 5: Migrate File Operations and Drag/Drop to the New Surface

**Files:**
- Modify: `web/file-explorer.js`
- Modify: `web/app.js`
- Modify: `tests/file-explorer-surface.spec.ts`

**Step 1: Move browse/upload/mkdir/delete/download behavior**

Ensure the new controller owns:

- loading directories from `/api/browse`
- uploads
- folder creation
- delete flow
- download flow

**Step 2: Preserve drag/drop**

Port dragover, dragleave, and drop handling to the new explorer root so uploads still work in both layout modes.

**Step 3: Keep selection state lightweight**

Add single-select behavior per workspace, but do not implement rename or preview yet.

**Step 4: Run the focused tests**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:e2e:file-explorer
```

Expected: PASS.

**Step 5: Commit**

```bash
git add web/file-explorer.js web/app.js tests/file-explorer-surface.spec.ts
git commit -m "feat(files): migrate explorer operations to shared surface"
```

### Task 6: Remove Legacy File Modal and Refresh Product Docs

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `README.md`
- Modify: `docs/product-guide.md`

**Step 1: Remove the old modal-only Files surface**

Delete the legacy `#file-modal` markup once all entry points and tests use the new explorer.

**Step 2: Update docs**

Document:

- persistent desktop explorer sidebar
- mobile explorer overlay
- workspace-aware path memory
- Files/Git mutual exclusion in the right-side shell surfaces

**Step 3: Update help copy if needed**

Make sure help text no longer implies Files opens a blocking modal.

**Step 4: Run the regression slice**

Run:

```bash
cd /home/deploy/deckterm_dev
bun run test:unit
bun run test:e2e:navigation
bun run test:e2e:navigation-surface
bun run test:e2e:file-explorer
bun run test:e2e:workspace
```

Expected: PASS.

**Step 5: Manual verification**

Check on `http://localhost:4174`:

- desktop Files opens a docked explorer sidebar
- mobile Files opens a full overlay
- switching workspace restores remembered file path
- Git and Files do not overlap
- upload and folder creation still feel fast

**Step 6: Commit**

```bash
git add web/index.html web/styles.css README.md docs/product-guide.md
git commit -m "docs(files): document explorer sidebar"
```
