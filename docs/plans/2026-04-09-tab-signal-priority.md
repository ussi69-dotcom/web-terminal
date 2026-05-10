# Desktop Tab Label and Signal Priority Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent desktop tab labels from colliding with signal badges by shrinking first, then wrapping, then truncating, before any unavoidable crowding.

**Architecture:** Update the tab markup so label and badge live in a shared content container, then add a small runtime fit controller in `web/app.js` that assigns ordered content-fit states per tab. CSS in `web/styles.css` will define the visual behavior for each stage, and Playwright will verify the progression on a long-label-plus-badge case.

**Tech Stack:** Bun, vanilla JS, xterm.js shell UI, Playwright

---

### Task 1: Add a failing desktop regression for label/badge degradation order

**Files:**

- Modify: `tests/navigation-surface.spec.ts`

**Step 1: Write the failing Playwright regression**

Create a desktop test that:

- opens a few tabs
- injects a long tab label and long signal badge
- resizes through multiple desktop widths
- asserts the tab progresses through `compact` or `wrapped` before `truncated`
- asserts the label and badge do not overlap in the earlier states

**Step 2: Run the targeted regression to confirm failure**

Run: `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts -g "degrades long tab labels before allowing badge overlap" --workers=1 --reporter=line`

Expected: FAIL before the implementation exists.

### Task 2: Implement per-tab content-fit state selection

**Files:**

- Modify: `web/app.js`

**Step 1: Update tab markup**

Wrap the label and badge inside a shared tab copy container.

**Step 2: Add measured content-fit sync**

After tab render and desktop toolbar sync, measure each tab copy area and assign:

- `roomy`
- `compact`
- `wrapped`
- `truncated`
- `cramped`

Pick the first stage that fits.

**Step 3: Re-run the targeted regression**

Run the same Playwright command and confirm it now passes.

### Task 3: Implement the staged CSS behavior

**Files:**

- Modify: `web/styles.css`

**Step 1: Convert tab layout to a copy-area grid**

Keep dot, index, and close button stable while the copy area owns the adaptive behavior.

**Step 2: Define the stage rules**

- compact: smaller spacing and badge sizing
- wrapped: allow two rows
- truncated: enable ellipsis on label and badge
- cramped: last-resort state only

**Step 3: Verify existing desktop tab-wrap behavior still works**

Run: `bun run test:e2e:navigation-surface`

Expected: PASS.

### Task 4: Final verification

**Files:**

- No code changes expected

**Step 1: Run focused desktop regression coverage**

Run: `bun run test:e2e:navigation-surface`

**Step 2: Run smoke input coverage already touched in this branch**

Run: `bun run test:e2e:smoke`

**Step 3: Manually inspect the long badge case on desktop**

Check that:

- the tab shrinks before wrapping
- wraps before truncating
- only enters the cramped state in extreme widths
