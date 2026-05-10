# Desktop Toolbar Overflow Density Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the desktop toolbar react to real width pressure so primary actions collapse to icon-only before tabs disappear, while keeping the shell on one row.

**Architecture:** Keep the current compact-shell structure and add a width-aware density controller for desktop chrome. A pure helper in `web/navigation-surface.js` will choose the best density tier from measured widths, `web/app.js` will measure and apply it, and `web/styles.css` will compress tab labels before relying on tab-strip scroll.

**Tech Stack:** Bun, vanilla JS, xterm.js shell UI, Playwright, Bun unit tests

---

### Task 1: Add a pure width-aware density helper

**Files:**

- Modify: `web/navigation-surface.js`
- Test: `web/navigation-surface.test.js`

**Step 1: Write the failing unit tests**

Add tests in `web/navigation-surface.test.js` for a helper that:

- returns `normal` when the full action width fits
- returns `compact` or `tight` when only smaller footprints fit
- returns `icon-only` when only the smallest footprint fits
- falls back safely when inputs are missing or invalid

Example test shape:

```js
test("resolveDesktopActionDensityTier chooses the first tier that fits", () => {
  expect(
    resolveDesktopActionDensityTier({
      availableWidth: 220,
      widthsByTier: {
        normal: 280,
        compact: 250,
        tight: 228,
        "icon-only": 180,
      },
    }),
  ).toBe("icon-only");
});
```

**Step 2: Run the unit test to confirm failure**

Run: `bun test ./web/navigation-surface.test.js`

Expected: FAIL because `resolveDesktopActionDensityTier` does not exist yet.

**Step 3: Implement the minimal helper**

In `web/navigation-surface.js`, add a pure helper that iterates the ordered tiers:

```js
const DESKTOP_DENSITY_ORDER = ["normal", "compact", "tight", "icon-only"];

function resolveDesktopActionDensityTier({
  availableWidth,
  widthsByTier,
} = {}) {
  const available = Number(availableWidth);
  if (!Number.isFinite(available) || available <= 0) return "icon-only";

  for (const tier of DESKTOP_DENSITY_ORDER) {
    const width = Number(widthsByTier?.[tier]);
    if (Number.isFinite(width) && width <= available) {
      return tier;
    }
  }

  return "icon-only";
}
```

Export it next to the existing navigation helpers.

**Step 4: Run the unit test to confirm pass**

Run: `bun test ./web/navigation-surface.test.js`

Expected: PASS for the new density-resolution cases.

**Step 5: Commit**

```bash
git add web/navigation-surface.js web/navigation-surface.test.js
git commit -m "test(navigation): add width-aware toolbar density helper"
```

### Task 2: Measure desktop toolbar pressure in runtime

**Files:**

- Modify: `web/app.js`

**Step 1: Write the failing integration expectation**

Add a small DOM-driven unit or browser-level expectation first. If a light unit harness is not practical in the current structure, start with the Playwright coverage in Task 4 and use that as the failing regression test before the runtime change.

**Step 2: Add runtime measurement helpers**

In `web/app.js`, near the primary-action rendering logic around `renderPrimaryActionBar`, add helpers to:

- collect the desktop action bar element
- temporarily measure action-bar width for each density tier
- compute how much toolbar width remains once fixed chrome is accounted for

Recommended helper outline:

```js
getDesktopToolbarChromeMetrics() {
  return {
    toolbarWidth: this.toolbar?.clientWidth || 0,
    actionsWidthByTier: this.measureDesktopActionWidthsByTier(),
    tabsMinWidth: this.getDesktopTabStripReservedWidth(),
    cwdWidth: this.directoryInput?.closest(".dir-input")?.offsetWidth || 0,
    statsWidth: document.getElementById("server-stats")?.offsetWidth || 0,
  };
}
```

Use `requestAnimationFrame` or a small microtask batch to avoid measuring repeatedly during the same synchronous render burst.

**Step 3: Replace count-based desktop density selection**

Change the desktop branch of `renderPrimaryActionBar` so it no longer uses only pinned count. Use the new helper to derive `root.dataset.density` from measured width. Keep the old count-based `getActionDensityTier("desktop", ...)` as a fallback if measurement returns zero or the toolbar is not mounted yet.

**Step 4: Re-run targeted tests**

Run: `bun test ./web/navigation-surface.test.js`

Expected: PASS, ensuring the pure helper still works after integration.

**Step 5: Commit**

```bash
git add web/app.js web/navigation-surface.js web/navigation-surface.test.js
git commit -m "feat(toolbar): drive desktop action density from width"
```

### Task 3: Compress tab labels before tab-strip overflow

**Files:**

- Modify: `web/styles.css`
- Modify: `web/app.js`

**Step 1: Add the failing UI expectation**

Create or extend a browser regression so a narrow desktop viewport with many tabs expects:

- primary actions to become icon-only
- tabs to stay visible with ellipsis
- the toolbar to stay single-row

**Step 2: Add a runtime tab-density attribute**

In `web/app.js`, set a second dataset attribute such as `data-tab-density` on the toolbar or tab strip. A simple version can map action density to tab-label width:

- `normal` -> `120px`
- `compact` -> `104px`
- `tight` -> `88px`
- `icon-only` -> `72px`

**Step 3: Update CSS for tab label compression**

In `web/styles.css`, change `.tab-label` from a fixed max width to a variable driven by runtime state:

```css
.toolbar {
  --tab-label-max-width: 120px;
}

.toolbar[data-tab-density="compact"] {
  --tab-label-max-width: 104px;
}

.toolbar[data-tab-density="tight"] {
  --tab-label-max-width: 88px;
}

.toolbar[data-tab-density="icon-only"] {
  --tab-label-max-width: 72px;
}

.tab-label {
  max-width: var(--tab-label-max-width);
}
```

Do not add toolbar wrapping. Keep tab-strip horizontal overflow enabled.

**Step 4: Run the narrow regression**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS on the desktop toolbar regression and no new failures in the existing navigation-surface checks.

**Step 5: Commit**

```bash
git add web/app.js web/styles.css tests/navigation-surface.spec.ts
git commit -m "feat(tabs): compress labels before toolbar overflow"
```

### Task 4: Cover the real overflow scenario end-to-end

**Files:**

- Modify: `tests/navigation-surface.spec.ts`
- Optionally modify: `tests/fixtures.ts`

**Step 1: Write the failing Playwright regression**

Add a desktop test that:

1. opens enough workspace tabs to pressure the toolbar
2. customizes the desktop primary actions so extra buttons are pinned
3. resizes to a narrower desktop viewport
4. asserts:
   - `.toolbar` remains single-row
   - `.desktop-primary-actions` has `data-density="icon-only"` or `tight` depending on width
   - the `More` button is still visible and clickable by accessible name
   - `.tabs` remains horizontally scrollable

Example assertion shape:

```ts
await expect(page.locator(".desktop-primary-actions")).toHaveAttribute(
  "data-density",
  /tight|icon-only/,
);
await expect(page.locator(".toolbar")).toHaveJSProperty("scrollHeight", 48);
```

Prefer a less brittle height assertion if the actual shell height varies by platform; reading computed line/box height through `evaluate` is acceptable.

**Step 2: Run the new test to confirm failure**

Run: `bun run test:e2e:navigation-surface`

Expected: FAIL before the runtime density changes are complete.

**Step 3: Adjust selectors and helper coverage**

If needed, add a small helper in `tests/fixtures.ts` to create multiple tabs quickly so the regression stays short and deterministic.

**Step 4: Re-run the navigation surface suite**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS.

**Step 5: Commit**

```bash
git add tests/navigation-surface.spec.ts tests/fixtures.ts
git commit -m "test(toolbar): cover tab-pressure overflow behavior"
```

### Task 5: Final verification

**Files:**

- No code changes expected

**Step 1: Run unit tests**

Run: `bun run test:unit`

Expected: PASS.

**Step 2: Run focused e2e**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS against `http://localhost:4174`.

**Step 3: Smoke-check the desktop shell manually**

Run:

```bash
bun run dev
```

Then verify in the browser:

- open many tabs
- pin extra primary actions
- shrink the viewport
- confirm action labels collapse before tabs vanish
- confirm the toolbar does not wrap

**Step 4: Commit**

```bash
git status --short
```

Expected: only the intended toolbar-related files remain changed.
