# Shell Action Layout Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Umožnit uživatelům upravovat desktop a mobile primary action lišty pomocí drag-and-drop editoru uvnitř `More`, s per-device layout persistencí a density fallbackem až do `icon-only` režimu.

**Architecture:** Rozšíříme navigation surface vrstvu o klientský layout store a čisté operace pro pin/unpin/reorder, pak přepojíme desktop/mobile action bary na dynamický render z tohoto state. `More` sheet dostane edit mód s custom pointer-driven drag controllerem, který funguje pro myš i touch bez HTML5 drag-and-drop API.

**Tech Stack:** Bun, Vanilla JS, Playwright, Bun test, localStorage.

---

### Task 1: Add Failing Coverage for Layout Customization

**Files:**
- Modify: `tests/navigation-surface.spec.ts`
- Modify: `tests/mobile-regressions.spec.ts`
- Modify: `tests/fixtures.ts`

**Step 1: Write failing desktop customization coverage**

Add an E2E scenario asserting that on desktop:
- `More` opens a sheet with an `Edit layout` affordance
- edit mode exposes `Pinned` and `Available in More`
- dragging an action from available into pinned updates the top bar immediately
- reload preserves the customized top bar

**Step 2: Write failing mobile customization coverage**

Add an E2E scenario asserting that on mobile:
- `More` exposes the same edit flow
- customization is performed in `Mobile` mode
- dragging an action into pinned updates the bottom bar immediately
- moving it back returns it to `More`

**Step 3: Add reset coverage**

Add a scenario that customizes a layout, clicks `Reset defaults`, and verifies the default desktop/mobile pinned sets are restored.

**Step 4: Run targeted tests and confirm failure**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: FAIL because no layout editor or DnD customization exists yet.

**Step 5: Commit**

```bash
git add tests/navigation-surface.spec.ts tests/mobile-regressions.spec.ts tests/fixtures.ts
git commit -m "test(navigation): cover action layout customization"
```

### Task 2: Add a Testable Layout Store and Pure Operations

**Files:**
- Modify: `web/navigation-surface.js`
- Modify: `web/navigation-surface.test.js`

**Step 1: Write failing unit tests for layout persistence and operations**

Add unit tests for:
- loading defaults when storage is empty or invalid
- filtering unknown action ids
- keeping `more` fixed outside editable actions
- pin operation
- unpin operation
- reorder operation
- density tier calculation for desktop and mobile

**Step 2: Implement minimal pure helpers**

In `web/navigation-surface.js`, add:
- layout defaults
- load/save/reset/validate helpers
- customizable action lists for desktop/mobile
- pure pin/unpin/reorder helpers
- density tier helpers

Keep these functions data-only and DOM-free.

**Step 3: Run unit tests and confirm pass**

Run:
```bash
cd /home/deploy/deckterm_dev
bun test web/navigation-surface.test.js
```

Expected: PASS.

**Step 4: Commit**

```bash
git add web/navigation-surface.js web/navigation-surface.test.js
git commit -m "test(navigation): codify action layout customization"
```

### Task 3: Add Edit Mode to the More Sheet

**Files:**
- Modify: `web/index.html`
- Modify: `web/styles.css`
- Modify: `web/app.js`

**Step 1: Add edit affordances to the tools sheet**

In `web/index.html`, extend the `More` sheet with stable IDs for:
- `Edit layout`
- mode toggle `Desktop` / `Mobile`
- `Pinned` area
- `Available in More` area
- `Reset defaults`
- `Done`

Do not remove the normal tools sheet behavior; add an explicit edit sub-mode.

**Step 2: Style the edit surface**

In `web/styles.css`, add styles for:
- edit toolbar/controls
- pinned and available buckets
- draggable action chips
- placeholder/drop target states

**Step 3: Add state wiring in app.js**

Implement:
- tools sheet edit mode toggle
- active editor target (`desktop` or `mobile`)
- rendering of pinned/available chips from layout state
- reset/done actions

**Step 4: Run targeted tests**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts --workers=1 --reporter=line
```

Expected: edit affordance exists, but drag customization tests still fail.

**Step 5: Commit**

```bash
git add web/index.html web/styles.css web/app.js
git commit -m "feat(navigation): add action layout editor shell"
```

### Task 4: Implement Custom Drag-and-Drop for Pin, Unpin, and Reorder

**Files:**
- Modify: `web/app.js`
- Modify: `web/styles.css`

**Step 1: Add a pointer-driven drag controller**

Implement a custom drag layer in `web/app.js` that supports:
- pointerdown on action chip
- ghost preview
- placeholder targeting
- pointermove hover/drop detection
- pointerup finalize

Do not use native HTML5 drag-and-drop.

**Step 2: Wire drag outcomes to pure layout operations**

Map interactions to:
- available -> pinned = pin
- pinned -> available = unpin
- pinned -> pinned = reorder

Persist every successful change immediately.

**Step 3: Add visual drag states**

In `web/styles.css`, style:
- dragged chip
- ghost preview
- active drop target
- placeholder slot

**Step 4: Run targeted desktop and mobile tests**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: PASS for pin/unpin/reorder flows.

**Step 5: Commit**

```bash
git add web/app.js web/styles.css tests/navigation-surface.spec.ts tests/mobile-regressions.spec.ts
git commit -m "feat(navigation): add action layout drag and drop"
```

### Task 5: Render Desktop and Mobile Bars from the Custom Layout

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`
- Test: `tests/navigation-surface.spec.ts`
- Test: `tests/mobile-regressions.spec.ts`

**Step 1: Convert primary action bars to dynamic render targets**

Keep stable root containers for:
- desktop primary actions
- mobile primary actions

Move action rendering into `web/app.js` so the bars are built from current layout state rather than fixed button order.

**Step 2: Keep `More` fixed and appended last**

Ensure `More` is always rendered after the pinned actions for both desktop and mobile.

**Step 3: Preserve existing action bindings**

Make sure dynamic buttons still use the same `data-action` hooks and manager methods as the current static buttons.

**Step 4: Run targeted tests**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts file-explorer-surface.spec.ts mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: PASS with customized layouts reflected in runtime chrome.

**Step 5: Commit**

```bash
git add web/index.html web/app.js web/styles.css tests/navigation-surface.spec.ts tests/file-explorer-surface.spec.ts tests/mobile-regressions.spec.ts
git commit -m "feat(navigation): render custom primary action bars"
```

### Task 6: Add Density Tiers and Icon-Only Fallback

**Files:**
- Modify: `web/styles.css`
- Modify: `web/app.js`
- Modify: `tests/navigation-surface.spec.ts`
- Modify: `tests/mobile-regressions.spec.ts`

**Step 1: Add density-tier tests**

Add coverage for layouts with many pinned actions that verifies:
- the bar does not wrap
- compact styling applies
- icon-only fallback can be reached for dense layouts

**Step 2: Implement density tier calculation in runtime rendering**

In `web/app.js`, assign density classes based on pinned count for desktop and mobile.

**Step 3: Implement CSS density tiers**

In `web/styles.css`, add classes for:
- `density-normal`
- `density-compact`
- `density-tight`
- `density-icon-only`

Ensure labels can hide while preserving icons, tooltips, and tap targets.

**Step 4: Run targeted tests**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts mobile-regressions.spec.ts --workers=1 --reporter=line
```

Expected: PASS.

**Step 5: Commit**

```bash
git add web/styles.css web/app.js tests/navigation-surface.spec.ts tests/mobile-regressions.spec.ts
git commit -m "feat(navigation): add dense action bar fallback"
```

### Task 7: Update Docs and Run Full Relevant Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/product-guide.md`

**Step 1: Update docs**

Document:
- customizable desktop/mobile primary action bars
- `More` as fixed anchor
- edit flow inside `More`
- drag-and-drop customization
- reset defaults behavior

**Step 2: Run unit tests**

Run:
```bash
cd /home/deploy/deckterm_dev
bun run test:unit
```

Expected: PASS.

**Step 3: Run relevant E2E tests on dev**

Run:
```bash
cd /home/deploy/deckterm_dev/tests
PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts file-explorer-surface.spec.ts mobile-regressions.spec.ts size-warning.spec.ts --workers=1 --reporter=line
```

Expected: PASS.

**Step 4: Optional visual QA sweep**

Capture desktop and mobile screenshots showing:
- default layout
- edit mode
- customized layout
- dense/icon-only fallback

**Step 5: Commit**

```bash
git add README.md docs/product-guide.md
git commit -m "docs(navigation): document customizable action bars"
```
