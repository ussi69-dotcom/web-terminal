# Palette ROI MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Posílit DeckTerm command palette tak, aby fungovala jako `jump layer` pro workspace, cwd a git kontext, ne jen jako duplicitní menu viditelných tlačítek.

**Architecture:** Reuse stávající command palette controller v `web/app.js`, rozšířit ho o recent-workspace store a nové provider akce, které staví na existujících workspace snapshot datech, files surface a git endpointu. `Go to Directory...` bude řešené jako query-driven palette action nad aktuálním inputem, aby MVP nevyžadoval multi-step palette UI ani nový backend.

**Tech Stack:** Bun, Vanilla JS, localStorage, Playwright, Bun test.

---

### Task 1: Add Failing Coverage for Palette Jump Actions

**Files:**
- Modify: `tests/command-palette.spec.ts`
- Reuse helpers from: `tests/fixtures.ts`

**Step 1: Write failing recent-workspace coverage**

Add a desktop test that:

- creates a workspace in a fixture cwd
- switches away or creates another workspace
- opens the palette
- searches by the fixture cwd or label
- expects a recent-workspace style entry to return to the original cwd

Use expectations against:

- active tab state
- current directory shown in the active workspace

**Step 2: Write failing `Go to Directory...` coverage**

Add a desktop test that:

- creates a temporary fixture directory
- opens the palette
- types an absolute path query
- selects a `Go to Directory...` result
- expects DeckTerm to switch to an existing matching workspace or create a new one in that cwd

Assert:

- a tab/workspace exists for that cwd
- the active terminal cwd updates to the target path

**Step 3: Write failing `Reveal Current CWD in Files` coverage**

Add a desktop test that:

- creates a workspace in a known fixture directory
- opens the palette
- runs `Reveal Current CWD in Files`
- expects `#file-explorer` to open and its breadcrumb/path state to contain the workspace cwd

**Step 4: Write explicit checkout-entry coverage**

Extend coverage so palette does not only match raw branch names, but also exposes an explicit checkout entry path:

- search for `Checkout Git Branch`
- verify branch switching still works from the explicit entry flow

**Step 5: Run the targeted suite and confirm failure**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because recent workspace, explicit directory jump, reveal action, or explicit checkout entry do not exist yet.

**Step 6: Commit**

```bash
git add tests/command-palette.spec.ts
git commit -m "test(palette): cover jump-layer mvp"
```

### Task 2: Add a Recent Workspace Store and Pure Helpers

**Files:**
- Modify: `web/navigation-surface.js`
- Modify: `web/navigation-surface.test.js`

**Step 1: Write failing unit tests for recent workspace storage**

Add tests for:

- loading an empty recent-workspace list when storage is missing or invalid
- normalizing and deduplicating entries by cwd
- sorting entries by `lastUsedAt` descending
- trimming the store to a fixed max length
- preserving label snapshots

Use concrete payloads like:

```js
{
  cwd: "/tmp/project-a",
  label: "project-a",
  lastUsedAt: 1712265600000,
}
```

**Step 2: Implement pure recent-store helpers**

In `web/navigation-surface.js`, add DOM-free helpers for:

- `ACTION_RECENT_WORKSPACES_STORAGE_KEY`
- loading/saving/resetting recent workspace entries
- validating entry shape
- upserting a recent workspace by cwd
- sorting and limiting entries

Keep this logic reusable from `web/app.js`.

**Step 3: Run the unit suite**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test web/navigation-surface.test.js
```

Expected: PASS.

**Step 4: Commit**

```bash
git add web/navigation-surface.js web/navigation-surface.test.js
git commit -m "test(palette): add recent workspace helpers"
```

### Task 3: Wire Recent Workspace Actions into the Palette

**Files:**
- Modify: `web/app.js`
- Test: `tests/command-palette.spec.ts`

**Step 1: Record recent workspace usage**

In `web/app.js`, update workspace lifecycle touchpoints so the recent store is refreshed when:

- a workspace becomes active
- a terminal/workspace is created with a cwd
- cwd updates via OSC7 for the active workspace

Use normalized cwd values only.

**Step 2: Add recent-workspace palette provider**

Extend `registerCommandPaletteActions()` with a `Recent` provider that:

- reads recent entries from the new helper store
- matches against cwd and saved label
- marks entries that already exist in current tabs
- on run:
  - switches to the existing workspace if found by cwd
  - otherwise creates a new terminal/workspace in that cwd

**Step 3: Polish existing workspace provider**

Tighten the current `Workspaces` provider so matching is stronger for:

- cwd
- tab index
- label
- condensed tab text

Keep active workspace metadata visible.

**Step 4: Run the targeted suite**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts --workers=1 --reporter=line
```

Expected: recent-workspace scenarios pass; directory/reveal-specific cases may still fail.

**Step 5: Commit**

```bash
git add web/app.js tests/command-palette.spec.ts
git commit -m "feat(palette): add recent workspace actions"
```

### Task 4: Add `Go to Directory...` and `Reveal Current CWD in Files`

**Files:**
- Modify: `web/app.js`
- Test: `tests/command-palette.spec.ts`

**Step 1: Implement query-driven directory jump results**

In `web/app.js`, add palette behavior that turns a path-like query into a first-class result:

- treat absolute paths and `~/...` as candidates
- validate them through the existing browse API before execution
- title the result as `Go to Directory...`
- include the typed path in metadata

Do not add a modal prompt or multi-step palette mode in this MVP.

**Step 2: Implement switch-or-create directory behavior**

When the directory jump result runs:

- normalize the target path
- if a workspace already exists for that cwd, switch to it
- otherwise create a new terminal/workspace in that cwd
- if validation fails, surface a user-visible error and keep palette behavior predictable

**Step 3: Implement `Reveal Current CWD in Files`**

Add a contextual palette action that:

- reads active cwd
- opens the files surface
- loads the explorer directly at the current cwd

Reuse the existing file explorer controller instead of adding a new files flow.

**Step 4: Run the targeted suite**

Run:

```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts file-explorer-surface.spec.ts --workers=1 --reporter=line
```

Expected: PASS for directory jump and reveal-current-cwd flows.

**Step 5: Commit**

```bash
git add web/app.js tests/command-palette.spec.ts
git commit -m "feat(palette): add directory jump actions"
```

### Task 5: Polish Explicit Git Checkout Entry and Update Docs

**Files:**
- Modify: `web/app.js`
- Modify: `README.md`
- Modify: `docs/product-guide.md`
- Test: `tests/command-palette.spec.ts`

**Step 1: Add explicit `Checkout Git Branch...` entry point**

In the palette git provider, add an explicit action that:

- is discoverable by typing `checkout`, `branch`, or `git`
- opens or prioritizes branch results for the active cwd
- keeps reuse of the existing branches endpoint and checkout logic

This should complement, not remove, the existing branch-name matches.

**Step 2: Refresh git context after checkout**

Make sure a successful branch switch updates cached palette git context so repeated openings show the new current branch.

**Step 3: Document the palette jump layer**

Update docs to reflect that palette is now primarily for:

- switching workspaces
- reopening recent workspaces
- jumping to directories
- revealing cwd in files
- branch checkout

**Step 4: Run final verification on 4174**

Run:

```bash
cd /home/deploy/deckterm_dev
bun test web/navigation-surface.test.js
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test command-palette.spec.ts navigation-surface.spec.ts file-explorer-surface.spec.ts --workers=1 --reporter=line
```

Expected: PASS, with any pre-existing flaky bootstrap behavior called out explicitly if it appears.

**Step 5: Commit**

```bash
git add web/app.js README.md docs/product-guide.md tests/command-palette.spec.ts
git commit -m "docs(palette): document jump-layer mvp"
```
