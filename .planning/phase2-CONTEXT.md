# Phase 2 Context: Platform-Adaptive UI

> Preferences captured on 2026-01-18

## Decisions Locked

| Area               | Decision                           | Rationale                                                                                                    |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Platform detection | Touch capability + screen width    | `pointer: coarse` + `hover: none` + `< 768px` - more accurate than width alone, distinguishes hybrid devices |
| Desktop behavior   | Hidden with toggle button          | Clean look, maximum terminal space, power users can show via toolbar                                         |
| Mobile behavior    | Visible only with virtual keyboard | Uses visualViewport API (already implemented), saves space when keyboard closed                              |
| Toggle placement   | Keyboard icon in main toolbar      | Discoverable, consistent with existing UI (next to font +/- buttons)                                         |

## Implementation Notes

- Use CSS media queries `(pointer: coarse)` and `(hover: none)` combined with JS width check
- Toggle button should be a keyboard icon (e.g., `keyboard` from icon set or Unicode)
- On mobile, hook into existing `visualViewport.resize` event to detect keyboard open/close
- Keyboard height threshold: >100px difference between `window.innerHeight` and `visualViewport.height`
- Toggle state should persist in localStorage per device

## Technical References

- Current platform detection: `web/app.js` line 578 (`window.innerWidth < 768`)
- ExtraKeysManager: `web/app.js` lines 1227-1350
- visualViewport handler: `web/app.js` lines 2373-2378
- Extra keys HTML: `web/index.html` lines 111-144

## Open Questions (for planning to research)

- Best icon for keyboard toggle (Unicode vs SVG vs icon font)
- Animation for show/hide transition (slide vs fade)
- Should toggle state sync across tabs?

## Out of Scope for This Phase

- Gesture-based show/hide (swipe)
- Customizable extra keys layout
- Per-terminal extra keys visibility
