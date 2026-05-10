# Merged Workspace Tab Summary Design

**Date:** 2026-04-09

## Goal

Make merged workspace tabs show more than one folder and more than one status while keeping the close button fixed on the far right.

## Problem

- Merged workspace tabs currently inherit a single `cwd` label and a single primary signal badge.
- That hides the fact that the workspace contains multiple folders and multiple concurrent states.
- When tab content gets dense, the close button can feel visually dragged into the content instead of staying pinned to the trailing edge.

## Chosen Direction

- Keep the close button in its own right-aligned grid column that never shares space with label text.
- For single-terminal tabs, keep the current label + badge model.
- For merged workspace tabs, switch to a two-line summary:
  - line 1: up to two folder labels plus `+N` if more remain
  - line 2: up to two status labels plus `+N` if more remain
- Keep the tooltip as the full-fidelity source of truth with every folder path and every status label listed.

## Rendering Rules

- Folder summary is derived from the unique formatted folder labels in the workspace.
- Status summary is derived from the unique signal descriptors across all terminals in the workspace.
- Merged tabs hide the single primary signal badge and show the text summary line instead.
- Single tabs keep the primary signal badge.

## Risks

- Summary text can get dense in wrapped tabs, so the existing `copyFit` stages must treat merged metadata as part of the fit calculation.
- Tooltip content should switch from a single cwd line to a merged folder list without regressing the single-tab case.

## Verification

- Playwright regression for merged-tab summary and full tooltip contents.
- Playwright regression for close button alignment on merged tabs.
