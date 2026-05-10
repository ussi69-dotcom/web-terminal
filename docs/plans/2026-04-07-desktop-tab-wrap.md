# Desktop Two-Row Tab Strip Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep desktop tabs visible under heavy tab counts by shrinking action buttons first, then shrinking tabs, then wrapping the tab strip to two rows before any remaining overflow fallback.

**Architecture:** Reuse the existing desktop action-density controller, then add a desktop-only tab layout controller that measures available width and tab count to choose between one-row and two-row tab presentation. CSS will own the wrapped layout, while `web/app.js` will set the runtime dataset state and refit terminals after toolbar height changes.

**Tech Stack:** Bun, vanilla JS, xterm.js shell UI, Playwright, Bun unit tests

---

### Task 1: Add a pure desktop tab layout resolver

**Files:**

- Modify: `web/navigation-surface.js`
- Test: `web/navigation-surface.test.js`

**Step 1: Write the failing unit tests**

Add tests for a helper that decides the desktop tab layout from:

- available tab-strip width
- tab count
- preferred tab width
- minimum comfortable tab width
- maximum visible row count

Cover:

- one-row layout when tabs fit comfortably
- two-row layout when one row would be too narrow
- explicit overflow count when even two rows cannot fit everything comfortably
- safe fallback for invalid inputs

**Step 2: Run the unit test to confirm failure**

Run: `bun test ./web/navigation-surface.test.js`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write the minimal helper**

Add and export a pure helper that returns a shape like:

```js
{
  rowCount: 1,
  visibleCount: 8,
  overflowCount: 0,
  tabWidth: 132,
}
```

The helper should fail closed to a one-row conservative layout when measurements are invalid.

**Step 4: Run the unit test to confirm pass**

Run: `bun test ./web/navigation-surface.test.js`

Expected: PASS for the new tab-layout cases.

**Step 5: Commit**

```bash
git add web/navigation-surface.js web/navigation-surface.test.js
git commit -m "test(tabs): add desktop tab layout resolver"
```

### Task 2: Add a failing desktop browser regression for wrapped tabs

**Files:**

- Modify: `tests/navigation-surface.spec.ts`

**Step 1: Write the failing Playwright regression**

Add a desktop test that:

1. opens enough tabs to pressure the toolbar
2. pins an extra primary action so action density still matters
3. resizes to a medium desktop width
4. asserts:
   - primary actions become `tight` or `icon-only`
   - the tab strip uses two rows
   - at least several tabs remain directly visible without horizontal tab scrolling
   - the toolbar height increases
   - no vertical scrollbar appears inside the tab strip

**Step 2: Run the regression to confirm failure**

Run: `bun run test:e2e:navigation-surface`

Expected: FAIL before the wrapped-tab implementation exists.

**Step 3: Tighten selectors if needed**

If the regression is noisy, add deterministic helpers for tab creation or row counting inside the test.

**Step 4: Re-run to confirm the failure is the intended one**

Run: `bun run test:e2e:navigation-surface`

Expected: FAIL specifically on the new two-row behavior assertions.

**Step 5: Commit**

```bash
git add tests/navigation-surface.spec.ts
git commit -m "test(tabs): add two-row desktop tab regression"
```

### Task 3: Implement desktop tab layout runtime state

**Files:**

- Modify: `web/app.js`

**Step 1: Add a measured desktop tab layout sync**

Near the current desktop toolbar density scheduling, add a second measured sync that:

- reads the current desktop toolbar mode
- measures available tab width after non-tab chrome is rendered
- counts visible tabs
- asks the new pure helper for:
  - row count
  - tab width
  - visible tab capacity
  - overflow count

Batch this sync with `requestAnimationFrame`.

**Step 2: Store the runtime state on the toolbar/tab strip**

Apply desktop-only runtime attributes such as:

- `data-tab-rows`
- `data-tab-overflow`
- CSS variables for computed tab width

Keep mobile untouched.

**Step 3: Refit the terminal after row-count changes**

When the desktop toolbar height changes because the tab strip wrapped or unwrapped, trigger the existing terminal fit path so the viewport does not stay stale.

**Step 4: Re-run targeted tests**

Run: `bun test ./web/navigation-surface.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add web/app.js web/navigation-surface.js web/navigation-surface.test.js
git commit -m "feat(tabs): sync desktop wrapped-tab state"
```

### Task 4: Implement wrapped tab-strip styling

**Files:**

- Modify: `web/styles.css`

**Step 1: Convert desktop tabs to a wrap-capable layout**

Change the desktop tab strip so it can:

- keep one row by default
- wrap to two rows when `data-tab-rows="2"`
- cap its visual height to two rows
- avoid showing a vertical scrollbar in the common case

**Step 2: Make tab widths responsive**

Drive `.tab` or `.tab-label` width from runtime CSS variables with a comfortable minimum and sensible max width.

**Step 3: Preserve interaction quality**

Keep tab hit targets, active styling, drag affordances, and close buttons usable in the denser two-row layout.

**Step 4: Run the Playwright regression**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS on the new two-row regression and the existing navigation-surface suite.

**Step 5: Commit**

```bash
git add web/styles.css tests/navigation-surface.spec.ts web/app.js
git commit -m "feat(toolbar): wrap desktop tabs to two rows"
```

### Task 5: Final verification

**Files:**

- No code changes expected

**Step 1: Run the full unit suite**

Run: `bun run test:unit`

Expected: PASS with 0 failures.

**Step 2: Run the focused e2e suite**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS with the desktop wrapped-tab regression included.

**Step 3: Manually verify on dev**

Check on `http://localhost:4174` that:

- opening many desktop tabs produces two visible tab rows
- action buttons collapse before tabs wrap
- terminal height adjusts after the wrap change

**Step 4: Capture remaining risk**

Document any residual edge case such as drag-and-drop on the second row or extremely narrow desktop widths.

**Step 5: Commit**

```bash
git add docs/plans/2026-04-07-desktop-tab-wrap-design.md docs/plans/2026-04-07-desktop-tab-wrap.md
git commit -m "docs: plan desktop two-row tab strip"
```
