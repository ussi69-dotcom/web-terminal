# Desktop Tab Label and Signal Priority Design

**Date:** 2026-04-09

## Goal

Keep desktop tab labels readable when signal badges such as `Codex Responding` are present by degrading the tab content in this order:

1. shrink spacing and typography
2. wrap the tab content to two rows
3. truncate label and badge text
4. only then allow unavoidable crowding

The design should prevent premature overlap between the tab title and the signal badge when the tab still has room to adapt.

## Current State

- Desktop tabs render as a single horizontal flex row.
- `.tab-label` is permanently `nowrap` with ellipsis.
- `.tab-signal-badge` is also permanently `nowrap`.
- When a tab has both a long label and a long signal badge, the content competes for the same row immediately.

That means the current implementation can visually collide before it has used the more readable fallback states.

## Approaches Considered

### 1. CSS-only flex tuning

**Pros**

- small code change
- no runtime measurements

**Cons**

- hard to guarantee the requested degradation order
- browser flex decisions vary across widths and badge lengths
- overlap can still appear too early

### 2. Runtime content-fit states per tab plus CSS layout stages

**Pros**

- directly models the requested order
- responds to real label and badge lengths
- keeps short tabs unaffected

**Cons**

- adds a small measurement pass after tab render and resize
- requires one extra wrapper element in tab markup

### 3. Global toolbar-wide density states for all tabs

**Pros**

- simpler than per-tab measurement

**Cons**

- punishes short tabs when only one long tab is crowded
- still cannot reliably defer truncation until after wrapping

## Chosen Approach

Choose **per-tab content-fit states driven by runtime measurement**.

## Technical Direction

- Change tab markup so label and signal badge share a dedicated `.tab-copy` content area between the index and close button.
- Add ordered tab content states:
  - `roomy`
  - `compact`
  - `wrapped`
  - `truncated`
  - `cramped`
- Let CSS define each state:
  - `roomy`: current single-line presentation
  - `compact`: smaller gaps, smaller badge, slightly denser text
  - `wrapped`: two-row content area with badge allowed to drop below the label
  - `truncated`: two-row layout stays, but label and badge gain ellipsis clamps
  - `cramped`: emergency fallback when even truncated content cannot avoid crowding
- After each tab render and desktop resize sync, measure the available copy width and promote the tab through the states until one fits.

## Testing

- Add a desktop Playwright regression that injects a long label plus a long signal badge and checks:
  - no overlap while the tab still has width to shrink
  - wrapping happens before truncation
  - truncation happens before the emergency cramped state

## Risks

- repeated measurement during resize can jitter unless batched with the existing toolbar sync
- badge wrapping needs to preserve hit targets and visual rhythm in both one-row and two-row tab strips

## Recommendation

Implement the per-tab state machine now and keep the final cramped state as a last-resort fallback only.
