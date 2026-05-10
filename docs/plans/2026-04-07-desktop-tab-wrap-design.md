# Desktop Two-Row Tab Strip Design

**Date:** 2026-04-07

## Goal

Keep desktop terminal tabs directly visible when many workspaces are open by letting the tab strip adapt in this order:

1. primary action buttons collapse to denser modes
2. tabs shrink to a smaller but still usable width
3. tabs wrap to a second desktop row
4. only the remaining overflow falls back to an explicit overflow affordance

The design should prefer visible tabs over strict single-row chrome while avoiding hidden tab loss and unstable scrolling behavior.

## Current State

- Desktop primary actions already support `normal`, `compact`, `tight`, and `icon-only` density tiers.
- The current desktop toolbar keeps everything on one row.
- Tab labels compress, but the tab strip still overflows horizontally once the available width runs out.
- Terminal container sizing already reads the live toolbar height, so a two-row desktop toolbar is mechanically supported.

That means the current implementation protects action buttons better than before, but it still does not satisfy the user goal of keeping all desktop tabs visible.

## Approaches Considered

### 1. Keep single-row desktop chrome and rely on tab-strip horizontal scroll

**Pros**

- smallest change from the current implementation
- no extra toolbar height

**Cons**

- still hides tabs once enough are open
- creates discoverability and scanning problems
- does not satisfy the requirement to keep up to 10 tabs visible in normal use

### 2. Allow the tab strip to wrap up to two rows, with adaptive tab widths first

**Pros**

- keeps more tabs directly visible
- preserves desktop muscle memory better than vertical scrolling inside the strip
- only costs one extra row when truly needed
- works well with the existing action-density fallback

**Cons**

- changes toolbar height dynamically
- requires tab layout measurement and row-state hysteresis to avoid jitter near breakpoints

### 3. Add a vertical scrollbar to the tab strip after aggressive shrinking

**Pros**

- keeps the overall toolbar height tighter

**Cons**

- poor discoverability
- awkward pointer and wheel behavior above a terminal viewport
- still hides tabs, only in a less natural axis

## Chosen Approach

Choose **adaptive tab widths plus two-row wrapping on desktop**, capped at two visible rows, with explicit overflow only after the second row is full.

## Behavior Rules

### Desktop

- Keep the desktop action buttons on the existing density ladder:
  - `normal`
  - `compact`
  - `tight`
  - `icon-only`
- After action buttons compress, reduce tab width responsively.
- When one row still cannot show the open tabs at a comfortable minimum width, wrap the tab strip to a second row.
- Cap the visible desktop tab strip at two rows.
- Do not use a vertical scrollbar inside the tab strip as the normal overflow strategy.
- If even two rows are insufficient, expose the remaining hidden tabs through an explicit overflow affordance such as `+N` or a secondary all-tabs entry point.
- Mobile behavior stays unchanged.

### Comfort Boundaries

- Tab widths may shrink with the window, but not below a defined minimum comfortable desktop width.
- Wrapping should happen before tabs become too narrow to identify reliably.
- The transition between one-row and two-row desktop tabs should avoid rapid flicker during resize.

## Technical Direction

- Extend desktop tab-strip layout from a single-row horizontal list to a wrap-capable layout.
- Add a runtime layout state for the desktop tab strip, separate from action density:
  - row count
  - computed tab min/max width
  - whether second-row overflow is active
- Use runtime measurement of:
  - toolbar width
  - action-bar width at the current density
  - non-tab chrome width
  - tab count
- Derive the desktop tab presentation from those measurements:
  - single-row compact tabs when they still fit comfortably
  - two-row tabs when one row would drop below the comfort threshold
  - explicit overflow fallback only after the two-row cap is reached
- Re-run terminal fit after desktop toolbar height changes.

## Testing

- Unit coverage for any new pure helper that resolves desktop tab presentation thresholds.
- Desktop Playwright regression that opens many tabs and confirms:
  - toolbar height grows when second-row tabs are needed
  - tabs remain visible across two rows
  - action buttons still collapse before tab wrap
  - no vertical scrollbar appears inside the tab strip
  - the terminal viewport resizes correctly after toolbar height changes

## Risks

- Frequent DOM measurement can cause resize thrash unless batched.
- Tab drag-and-drop may need selector or hit-target adjustments once the strip wraps.
- Height changes in the toolbar can create visible terminal jumps if fit is not re-triggered promptly.

## Recommendation

Implement desktop adaptive tab widths with a two-row cap now. Leave vertical tab-strip scrolling off the table and add an explicit overflow fallback only if real usage still exceeds the two-row capacity.
