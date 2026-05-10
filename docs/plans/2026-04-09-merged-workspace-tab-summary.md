# Merged Workspace Tab Summary Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show multiple folders and multiple statuses in merged workspace tabs while keeping the close button pinned to the far right.

**Architecture:** Extend workspace snapshot generation in `web/app.js` to compute unique folder and status summaries, render merged tabs with a secondary metadata line, and preserve the single-tab badge model. Keep the close button in its own trailing grid slot in `web/styles.css`, and verify the behavior with focused Playwright regressions in both `tests/navigation-surface.spec.ts` and `tests/workspace-signals.spec.ts`.

**Tech Stack:** Bun, vanilla JS, Playwright, xterm.js shell UI

---

### Task 1: Add failing regressions

**Files:**

- Modify: `tests/navigation-surface.spec.ts`
- Modify: `tests/workspace-signals.spec.ts`

**Step 1: Write a close-button alignment regression**

Add a desktop Playwright test that merges multiple workspaces and confirms the close button remains pinned to the trailing edge with a positive gap from the tab content.

**Step 2: Write a merged-summary regression**

Add a workspace telemetry Playwright test that merges three workspaces, injects distinct folders and statuses, and expects:

- at least two folders in the visible summary
- at least two statuses in the visible summary
- the single badge hidden for merged tabs
- the tooltip to contain every full folder path and every status

**Step 3: Run the targeted tests and confirm failure**

Run:

```bash
cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test navigation-surface.spec.ts -g "keeps the close button pinned to the right edge for merged workspace tabs" --workers=1 --reporter=line
cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts -g "merged workspace tabs summarize multiple folders and statuses while tooltip keeps the full list" --workers=1 --reporter=line
```

Expected: merged summary test fails against the old single-folder/single-status behavior.

### Task 2: Implement merged workspace summaries

**Files:**

- Modify: `web/app.js`

**Step 1: Extend workspace snapshot generation**

Add helpers for:

- unique ordered folder labels
- unique ordered folder paths
- unique ordered status labels
- compact `visible +N` summaries

**Step 2: Render merged tabs differently**

- single tab: keep label + badge
- merged tab: use label for folder summary, metadata line for status summary, hide badge

**Step 3: Update tooltip content**

- single tab: keep current cwd + signals
- merged tab: show full folder path list and full status list

### Task 3: Tighten tab layout styling

**Files:**

- Modify: `web/styles.css`

**Step 1: Keep close button in a dedicated trailing slot**

Use explicit trailing alignment and non-collapsing width so the close button cannot drift into the content block.

**Step 2: Style merged metadata**

Add `.tab-meta` as the second text line for merged tabs and keep it integrated with the existing fit stages.

### Task 4: Verify broader behavior

**Files:**

- No code changes expected

**Step 1: Run the full desktop navigation suite**

```bash
bun run test:e2e:navigation-surface
```

**Step 2: Run the full workspace signal suite**

```bash
cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test workspace-signals.spec.ts --workers=1 --reporter=line
```

**Step 3: Capture residual risk**

Note whether extremely dense merged tabs still need a future “show details” affordance beyond tooltip.
