# C2 File/Git/Task Gates + Doctor Hardening Implementation Plan

> **For the implementer:** Use test-driven-development for each behavior change. This is the C2 compatibility/hardening slice from `2026-05-12-deckterm-foundation-decisions.md`, **not** a broader redesign. C0, C1a, and C1b are already shipped on `dev`.

**Goal:** Bring host-access _file_, _git_, and _task_ endpoints under the same actor/root/grant resolution that C1 already enforces for terminal create/attach, add audit-lite telemetry for legacy path-only resolution (instead of per-request log spam), and surface state-dir / DB / bootstrap-token health (plus a remediation path) in the setup doctor.

**Architecture:** Reuse the existing C1 service seam — `getFoundationState()`, `requireFoundationCapability()`, `resolveFoundationRootIdForPath()`, `writeAuditEvent()`. Route handlers stay thin and call a shared `requireFileAccess()` helper. No new domain tables. Legacy bypass (`DECKTERM_LEGACY_NO_BOOTSTRAP`) must keep working unchanged for migration.

**Tech Stack:** Bun, Hono, `bun:sqlite`, existing `backend/services/foundation-state.ts` + `foundation-authorization.ts`, `backend/onboarding-doctor.ts`.

---

## Why this plan exists (review of the in-flight WIP)

A partial C2 was already started in the working tree (uncommitted) and reviewed on 2026-05-29:

- `backend/server.ts`: new top-level `requireFileAccess()` gate, wired into 6 file endpoints and all git endpoints (via `validateGitCwd`). **Architecturally correct** — reuses C1 services, writes deny audit rows, respects legacy bypass.
- `backend/onboarding-doctor.ts`: state-dir / DB-writable / bootstrap-token doctor checks **and** an `applyOnboardingRemediation()` function.
- `backend/task-runner.ts`: default worker/judge provider changed `codex → claude`.

Issues found, which this plan corrects:

1. **No tests.** The gates change auth behavior on ~13 endpoints with zero coverage. (C0/C1/C1b all shipped with tests.) — biggest risk.
2. **No plan doc.** C2 was started without the per-slice plan the project convention requires. — this document.
3. **Dead code.** `applyOnboardingRemediation()` is defined and imported into `server.ts` but wired to no route. Doctor remediation (C2 #4) is half-done.
4. **Log spam, not telemetry.** The deprecation `console.warn` fires on _every_ successful file access, not as the queryable "audit-lite" signal C2 #3 specifies.
5. **Unrelated change bundled in.** `task-runner.ts` `codex → claude` is not part of the security slice and contradicts the weekly model-research recommendation (keep `gpt-5.5`/codex as the delegator). **Parked for a separate decision; reverted out of this slice.**
6. **Task endpoints not gated.** C2 scope is file/git/**task**; the WIP only covers file + git.

Note: `tsc --noEmit` already fails on clean `dev` HEAD (pre-existing errors in `foundation-actors.test.ts`, `onboarding-doctor.ts`, `task-runner.ts`). The project verifies via `bun test` (runtime), not `tsc`. C2 must not _add_ new type errors but is not expected to fix the pre-existing ones.

---

## Current repo state observed

- `requireFileAccess(c, resolvedPath)` — top-level in `server.ts`. Returns allow on legacy bypass; else resolves `ownerId` via `getCurrentUser`, maps path → foundation root, denies `no_matching_root` (403) or delegates to `requireFoundationCapability("root.use", root, rootId)`.
- File endpoints gated: `GET /api/files` (browse), file read, write, mkdir, delete, rename (from+to).
- Git endpoints gated via `validateGitCwd(c, cwd)` → `requireFileAccess`.
- Task endpoints (`/api/tasks*`) **not** gated by root resolution; only `taskRunner` owner checks apply. `POST /api/tasks` accepts `projectRoot`; `POST /api/tasks/:id/start` opens a terminal in `task.workingDirectory`.
- `foundationStatePromise` is a **module-level singleton** → only one foundation state per process. API-level tests must use one foundation-bearing test per file (see `task-api.test.ts`).
- Seeded grants (`foundation-state.ts:78`) give the bootstrapped owner `root.use` on `*/*`, so the allow path works for the anonymous/dev owner.

---

## Acceptance criteria

1. File/git/task host-access endpoints resolve the actor's root grant before acting; unauthorized roots are denied with an audit row.
2. Legacy path-only resolution emits a queryable audit-lite signal (not a per-request `console.warn`).
3. Setup doctor reports state-dir presence/permissions, DB writability, and bootstrap-token permissions; a remediation endpoint can apply a doctor fix and re-run the doctor.
4. Legacy bypass (`DECKTERM_LEGACY_NO_BOOTSTRAP=1`) still short-circuits all new gates.
5. `bun run test:unit` is green, including new C2 tests. E2E smoke passes against :4174.
6. The `task-runner` provider default change is **not** part of this slice.

---

## Task breakdown

### C2-0 — Plan (this document) ✅

### C2-1 — Audit-lite for legacy path resolution (REFACTOR)

- Replace the per-request `console.warn` deprecation in `requireFileAccess` with a single `writeAuditEvent(..., decision:"allow", reason:"legacy_path_resolution", action:"file.access")` row carrying `{ path, rootId }`.
- Keep `debug()` line for local dev only.
- **Test:** allowed file access under a registered root writes exactly one `legacy_path_resolution` audit row.

### C2-2 — Gate task endpoints (NEW) ✅

- `POST /api/tasks`: resolve `body.projectRoot` via `resolveAllowedPath` + `requireFileAccess`; deny (403) before `taskRunner.createTask` when the root is forbidden/unauthorized, writing a `task.create`/`deny` audit row (taskRunner previously rejected silently without a foundation audit).
- **Tests:** task create with a forbidden `projectRoot` → 403 + audit deny row; allow path covered by `task-api.test.ts` (now bootstraps, because the gate enforces bootstrap consistently with terminal create).
- **Deferred:** `POST /api/tasks/:id/start` re-validation. `workingDirectory` is already validated at create time and there is no reachable deny scenario to test; revisit as defense-in-depth if multi-actor task handoff lands.

### C2-3 — Finish doctor remediation (COMPLETE the dead code) ✅

- Wired `applyOnboardingRemediation` to `POST /api/onboarding/remediate`, mirroring `/api/onboarding/apply`, returning `{ success, applied, report }`; `400` when `remediationId` is missing.
- **Tests:** `foundation-c2.test.ts` — unknown remediation id → `200` + `success:false` (route exists and degrades gracefully).
- **Side fix:** the WIP state-dir doctor check reported a _missing_ state dir as `warning`, which downgraded the overall doctor status and broke `onboarding-api.test.ts` under suite ordering (env leaks a deleted temp `DECKTERM_STATE_DIR` between files). Changed first-run absence to `ok`, consistent with the adjacent state-DB check.

### Test isolation note

`backend/server.ts` holds the foundation state as a module-level singleton (plus import-time root constants), so only one `./server`-importing foundation test can run per process. `foundation-c2.test.ts` therefore runs in its own `bun test` invocation in `test:unit` (same pattern as `foundation-bootstrap.test.ts`).

### C2-4 — Park the task-runner provider change

- Revert `backend/task-runner.ts` `codex → claude` from this working tree so C2 carries only security changes.
- Record the open decision (keep codex vs switch to claude) for a separate change. Do **not** silently keep it.

### C2-5 — Verify + commit

- `bun run test:unit` green; `cd tests && PW_BASE_URL=http://localhost:4174 npx playwright test reconnect-tab-status.spec.ts file-explorer-surface.spec.ts task-runner.spec.ts` smoke green against the dev service.
- Commit as one C2 slice on `dev`: `feat(security): gate file/git/task host-access endpoints + doctor hardening (C2)`.
- Do not push to `main`/prod (deploys via GitHub Actions) until the user validates on :4174.

---

## Out of scope (defer)

- Adding an explicit `rootId` param to file/git/task requests (the migration _off_ legacy path-only) — telemetry now, migration later.
- Permission editor UI, transcript policy UI, secrets, agent adapters, new tables.
- The `codex → claude` provider decision (C2-4 parks it).
