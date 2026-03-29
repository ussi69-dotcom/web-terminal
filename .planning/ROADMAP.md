# DeckTerm Upgrade Roadmap

## Phase Table

| Phase | Name                               | Description                                                  | Status     |
| ----- | ---------------------------------- | ------------------------------------------------------------ | ---------- |
| 1     | Workspace Signals & Telemetry      | Busy, port, worktree, and identity signals in tabs/workspaces | PLAN READY |
| 2     | Tmux-Rich Session Mode             | First-class tmux-backed workflows beyond persistence         | pending    |
| 3     | Keyboard & Workspace Ergonomics    | Browser-safe shortcuts, tab affordances, lower-friction UX   | pending    |
| 4     | Module Decomposition & Hardening   | Extract session/telemetry logic from large files             | pending    |
| 5     | Verification, Perf, Release Readiness | Regression coverage, performance checks, rollout prep     | pending    |

## Deliverables Per Phase

### Phase 1: Workspace Signals & Telemetry

- backend metadata contract for workspace/terminal status
- busy indicator for AI-active workspaces
- live port/dev-server indicator
- worktree detection that does not rely on naive path heuristics
- updated tab styling/tooltips for richer situational awareness
- focused tests for signal rendering and reconnect compatibility

### Phase 2: Tmux-Rich Session Mode

- explicit `TMUX_BACKEND` capabilities surfaced in DeckTerm
- at least one of:
  - linked session action
  - save/restore session command path
  - richer tmux session action menu
- backend guardrails so tmux-only features degrade cleanly in raw PTY mode
- smoke coverage for tmux-specific flows

### Phase 3: Keyboard & Workspace Ergonomics

- shortcut review against browser conflicts
- improved tab affordances for workspace state
- lower-noise default UI for desktop while preserving mobile usability
- stronger mapping between workspace identity and runtime state

### Phase 4: Module Decomposition & Hardening

- extract telemetry/session responsibilities from `backend/server.ts`
- extract workspace signal/tab logic from `web/app.js`
- preserve current behavior while shrinking blast radius for future work
- document new module boundaries

### Phase 5: Verification, Perf, Release Readiness

- expanded Playwright coverage on port `4174`
- unit coverage for status/color/worktree utilities
- manual validation matrix for raw PTY and tmux-backed modes
- README / planning docs refreshed for the upgrade state
- concise go/no-go checklist for rollout

## Dependencies and Sequencing

1. Phase 1 first.
Reason: it delivers the highest-value `gmux` inspiration with the lowest product risk.

2. Phase 2 after Phase 1 metadata exists.
Reason: tmux-rich features should consume the same status model rather than create a parallel one.

3. Phase 3 can overlap late Phase 2 work once tab/workspace metadata is stable.

4. Phase 4 follows after the new behavior exists and can be extracted safely.

5. Phase 5 closes the workstream after behavior and structure settle.

## Approval Points

- after Phase 1: confirm telemetry model and tab UX before adding deeper tmux behavior
- before Phase 2 ships: confirm which tmux workflows belong in the browser UI
- before Phase 4 large extractions: confirm acceptable refactor scope versus feature momentum
- before release/readiness signoff: confirm rollout posture for raw PTY and tmux-backed environments

## Risks By Phase

### Phase 1

- false positives or stale status for busy/port indicators
- polling overhead if metadata collection is too aggressive
- visual clutter if tab signals are too dense

### Phase 2

- tmux-only behavior diverging too far from raw PTY mode
- session lifecycle regressions during richer tmux interactions
- complexity from mixing browser concepts with tmux-native semantics

### Phase 3

- browser shortcut conflicts, especially on macOS
- accidental regression for mobile controls while optimizing desktop UX

### Phase 4

- refactor churn in large files
- hidden coupling between reconnect, telemetry, and input handling

### Phase 5

- flaky tmux-backed E2E coverage
- incomplete verification across both backend modes
