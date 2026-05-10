# Desktop Toolbar Overflow Density Design

**Date:** 2026-04-07

## Goal

Stabilize the desktop top bar when many workspace tabs are open so the shell remains single-row, predictable, and readable without letting the toolbar grow vertically or pushing core controls out of view.

## Current State

- Workspace tabs already live in a dedicated horizontal strip with overflow scrolling in [web/styles.css](/home/deploy/deckterm_dev/web/styles.css).
- Desktop primary actions already support `normal`, `compact`, `tight`, and `icon-only` density tiers in [web/styles.css](/home/deploy/deckterm_dev/web/styles.css).
- Runtime density selection is currently based only on pinned action count in [web/navigation-surface.js](/home/deploy/deckterm_dev/web/navigation-surface.js).

That means the action bar can switch to `icon-only` even when there is still room, or stay too wide when tabs, cwd, stats, and linked-view pressure the toolbar.

## Approaches Considered

### 1. Keep count-based density and rely on tab scrolling

**Pros**

- smallest code change
- preserves current action layout logic

**Cons**

- reacts to pinned count, not real width pressure
- still fails on narrow desktop widths, long cwd values, or many tabs
- makes the UI feel arbitrary because the same layout behaves differently depending on content

### 2. Width-aware action density plus tab label compression plus tab-strip scroll

**Pros**

- matches actual available space
- keeps the toolbar single-row and stable
- degrades in the right order: action labels first, then tab label width, then tab scrolling

**Cons**

- requires DOM measurement and resize coordination
- needs a small amount of extra e2e coverage

### 3. Allow desktop toolbar wrapping to a second row

**Pros**

- simplest visible overflow escape hatch

**Cons**

- changes terminal viewport height while tabs open and close
- creates vertical layout jump and weaker muscle memory
- conflicts with the existing compact-shell design direction

## Chosen Approach

Choose **width-aware action density plus tab label compression plus tab-strip scroll**.

## Behavior Rules

### Desktop

- Keep the desktop toolbar on a single row.
- Do not use multi-row wrapping as a normal overflow strategy.
- When space gets tight, primary action buttons degrade first:
  - `normal`
  - `compact`
  - `tight`
  - `icon-only`
- After action buttons reach the chosen density, tab labels may compress further.
- If the toolbar is still under pressure, only the tab strip should scroll horizontally.
- `More` remains permanently visible as the last primary action.
- The action bar should not depend on its own hidden horizontal scrollbar as the primary desktop behavior.

### Mobile

- No behavior change in this pass.
- Mobile keeps its existing single-row bottom action bar density model.

## Technical Direction

- Add a width-aware density resolver as a pure helper so it can be unit-tested.
- Measure desktop toolbar pressure in runtime from the actual shell chrome:
  - new button
  - tab strip
  - cwd field
  - linked view button
  - server stats
  - desktop primary actions
- Let runtime choose the smallest desktop density tier that keeps the toolbar stable.
- Expose a second runtime attribute for tab label compression, separate from action density.
- Keep the existing count-based helper only as a fallback if measurement is unavailable.

## Testing

- Unit tests for density resolution and fallback behavior.
- Desktop Playwright coverage for:
  - many tabs
  - extra pinned actions
  - narrow desktop width
  - persistent visibility of `More`
  - icon-only fallback on primary actions
  - tab strip remaining scrollable

## Risks

- Repeated measurement can cause layout thrash if done on every mutation without batching.
- Density changes can interfere with tab drag-and-drop if DOM updates are too eager.
- Icon-only buttons must preserve accessible names and tooltips.

## Recommendation

Implement width-aware desktop density now and keep wrapping off the table unless future usability testing proves the single-row model inadequate.
