# C1a Multiuser Foundation Implementation Plan

> **For Hermes:** Use test-driven-development for each code change. This is a small C1a slice, not the whole DeckTerm redesign.

**Goal:** Make DeckTerm's terminal host-access path explicitly multiuser by resolving a real actor from Cloudflare Access, persisting terminal ownership metadata, and enforcing attach/create decisions through a grant-capability seam.

**Architecture:** Keep Cloudflare Access as the production identity provider. Keep local/dev usage behind explicit legacy/dev bypasses only. Move actor/auth/grant logic out of ad-hoc `server.ts` helpers into services that C2 can reuse for file/git/task gates.

**Tech Stack:** Bun, Hono, `@hono/cloudflare-access`, `bun:sqlite`, existing `backend/services/foundation-state.ts` and `backend/services/foundation-authorization.ts`.

---

## Accepted product decision

For MVP multiuser, production identity comes from Cloudflare Access only.

- Cloudflare Access `sub` is the stable provider subject.
- Cloudflare Access `email` is the displayed/bootstrapped user email.
- Own login/password is explicitly out of scope.
- Anonymous/local actor remains only for test/dev/legacy compatibility gates; it must not become the production multiuser model.

---

## Current repo state observed

Relevant existing files:

- `backend/services/foundation-state.ts`
  - already creates `users`, `project_roots`, `terminal_sessions`, `audit_events`, `auth_identities`, `scoped_grants`.
  - already has `bootstrapFirstAdmin()`, `hasScopedGrant()`, `grantScopedCapability()`, and audit writes.
- `backend/services/foundation-authorization.ts`
  - already has a minimal route capability registry for `POST /api/terminals` and `/ws/terminals/:id`.
- `backend/server.ts`
  - terminal create and WebSocket attach already call `requireFoundationCapability()`.
  - terminal listing/delete/resize still use in-memory `ownerId` checks.
  - `getCurrentUser()` is still an ad-hoc helper returning `anonymous` when Cloudflare Access is not required.
  - terminal ownership exists in memory (`Terminal.ownerId`) but `terminal_sessions` is not yet the source of truth for authorization/session metadata.

Important gap: C1 is partially scaffolded, but not yet a clean multiuser domain layer. The next slice should refactor seams and add persistence without changing the UI.

---

## Acceptance criteria

1. Production-like requests resolve actor from Cloudflare Access only.
2. Actor resolution is centralized in a service, not duplicated in route handlers/WebSocket auth.
3. Bootstrap still supports the accepted admin bootstrap path.
4. Creating a terminal persists/updates `terminal_sessions` with `actor_user_id`, `root_id`, `cwd`, `status`.
5. Attaching to a terminal checks persisted owner/session metadata, not only the in-memory `Terminal.ownerId`.
6. User A cannot attach to User B's terminal unless admin/global grant allows it.
7. Admin can create/attach through existing seeded grants.
8. Denied create/attach attempts write audit rows with actor, action, resource, decision, reason.
9. Existing dev/E2E workflows still pass through explicit CI/dev compatibility flags, not accidental anonymous production behavior.

---

## Task 1: Extract actor resolution service

**Objective:** Centralize Cloudflare Access -> DeckTerm actor resolution.

**Files:**

- Create: `backend/services/foundation-actors.ts`
- Test: `backend/foundation-actors.test.ts`
- Modify: `backend/server.ts`

**Step 1: Write failing tests**

Create tests for:

- valid Cloudflare Access payload returns `{ id: sub, email, source: "cloudflare_access" }`.
- missing payload with `CF_ACCESS_REQUIRED=1` returns unauthorized.
- missing payload with explicit dev/CI legacy mode returns `{ id: "anonymous", source: "legacy_dev" }`.
- missing payload without explicit dev/CI mode is unauthorized in production-like env.

Suggested service shape:

```ts
export type DeckTermActor = {
  id: string;
  email: string;
  source: "cloudflare_access" | "legacy_dev";
};

export function resolveActorFromAccessPayload(options: {
  accessPayload?: CloudflareAccessPayload | null;
  env: Record<string, string | undefined>;
}):
  | { ok: true; actor: DeckTermActor }
  | { ok: false; status: 401; reason: "cloudflare_access_required" };
```

Run:

```bash
PATH=$HOME/.bun/bin:$PATH bun test ./backend/foundation-actors.test.ts
```

Expected first run: FAIL because the service does not exist.

**Step 2: Implement minimal service**

Implement `foundation-actors.ts`. Reuse the existing legacy/dev bypass concept; do not create new broad production bypasses.

**Step 3: Replace `getCurrentUser()` internals**

In `backend/server.ts`, keep route behavior stable but route through the new service. Return 401/403 explicitly where possible instead of throwing `Unauthorized` from `getCurrentUser()`.

**Step 4: Verify**

```bash
PATH=$HOME/.bun/bin:$PATH bun test ./backend/foundation-actors.test.ts ./backend/foundation-c1.test.ts
```

---

## Task 2: Add grant decision helper with admin semantics

**Objective:** Make capability decisions reusable for terminal/file/git/task gates.

**Files:**

- Modify: `backend/services/foundation-authorization.ts`
- Test: `backend/foundation-c1.test.ts` or new `backend/foundation-authorization.test.ts`
- Modify: `backend/server.ts`

**Step 1: Write failing tests**

Add tests for a helper like:

```ts
canUseCapability(db, {
  actorUserId,
  capability: "terminal.attach",
  resourceType: "terminal",
  resourceId: "term_123",
})
```

Expected behavior:

- admin/global grant allows.
- missing grant denies with `missing_capability`.
- exact resource grant allows.
- wildcard grant allows.

**Step 2: Implement helper**

This can initially wrap `hasScopedGrant()`; the win is a stable API and decision result object:

```ts
type CapabilityDecision =
  | { allow: true; reason: "granted" | "admin" }
  | { allow: false; reason: "missing_capability" };
```

**Step 3: Use helper inside `requireFoundationCapability()`**

Keep the route behavior unchanged, but remove direct grant-query logic from `server.ts` over time.

**Step 4: Verify**

```bash
PATH=$HOME/.bun/bin:$PATH bun test ./backend/foundation-c1.test.ts
```

---

## Task 3: Persist terminal session metadata on create

**Objective:** Make `terminal_sessions` reflect actual terminal lifecycle.

**Files:**

- Modify: `backend/services/foundation-state.ts`
- Test: `backend/foundation-c1.test.ts` or new `backend/terminal-ownership.test.ts`
- Modify: `backend/server.ts`

**Step 1: Write failing test**

Add a service test for:

```ts
recordTerminalSession(db, {
  id: "term_abc",
  actorUserId: "user_admin",
  rootId: "root_1",
  cwd: "/srv/app",
  status: "active",
});
```

Then assert row exists in `terminal_sessions`.

**Step 2: Implement service functions**

Add small functions:

```ts
recordTerminalSession(db, session)
markTerminalSessionEnded(db, id)
getTerminalSession(db, id)
```

Do not build a broad repository abstraction yet.

**Step 3: Wire terminal create**

After `createOwnedTerminal()`, write `terminal_sessions` row with:

- terminal id
- actor user id
- resolved project root id
- cwd
- active status

Important: currently root authorization passes `resourceId: resolvedCwd`; prefer resolving to `project_roots.id` in this task if cheap. If not, keep path compatibility but record a TODO in code and plan C1b.

**Step 4: Wire delete/exit**

When terminal is deleted or exits, mark session ended.

**Step 5: Verify**

```bash
PATH=$HOME/.bun/bin:$PATH bun test ./backend/foundation-c1.test.ts ./backend/task-api.test.ts
```

---

## Task 4: Authorize WebSocket attach from persisted terminal session

**Objective:** Make attach isolation survive beyond in-memory owner checks and align with multiuser domain semantics.

**Files:**

- Modify: `backend/server.ts`
- Modify: `backend/services/foundation-state.ts`
- Test: `backend/foundation-bootstrap.test.ts` or new route/integration test

**Step 1: Write failing integration test**

Create a server test that:

1. Bootstraps admin A.
2. Creates terminal as A.
3. Attempts WebSocket attach as B.
4. Expects 403 and an audit deny row.
5. Attaches as A or admin grant holder and expects success.

If WebSocket integration is too heavy, first write a service-level test for `canAttachTerminal(actor, terminalId)` using persisted session metadata, then add route coverage.

**Step 2: Implement attach helper**

```ts
authorizeTerminalAttach(db, { actorUserId, terminalId })
```

Rules:

- missing session -> deny/not_found or let route return 404 after terminal lookup.
- same `actor_user_id` -> allow.
- otherwise require `terminal.attach` grant for terminal id or wildcard.

**Step 3: Wire WS attach path**

In `server.ts` `/ws/terminals/:id` path:

- authenticate actor.
- ensure bootstrap/capability gate.
- check terminal exists.
- check persisted session ownership/grant.
- audit deny/allow.
- only then `server.upgrade()`.

**Step 4: Verify**

```bash
PATH=$HOME/.bun/bin:$PATH bun test ./backend/foundation-c1.test.ts ./backend/foundation-bootstrap.test.ts
```

---

## Task 5: Keep existing UX and tests green

**Objective:** Ensure the multiuser foundation does not regress current DeckTerm workflows.

**Files:**

- Modify tests only as needed for explicit dev/CI compatibility flags.

**Verification commands:**

```bash
PATH=$HOME/.bun/bin:$PATH bun run test:unit
cd tests && PW_BASE_URL=http://127.0.0.1:4174 npx playwright test workspace-signals.spec.ts onboarding.spec.ts --workers=1 --reporter=line
```

Expected: all pass.

---

## Explicit non-goals for C1a

- No permission editor UI.
- No username/password login.
- No secrets manager.
- No Docker/container isolation.
- No transcript policy UI.
- No full file/git/task endpoint gating in this PR. C1a should only make the actor/grant/session seams real enough for C2 to reuse.

---

## Recommended implementation order

1. Commit current test-contract cleanup separately.
2. Implement Task 1 and Task 2 as a small service-only PR/commit.
3. Implement Task 3 and Task 4 as the terminal ownership PR/commit.
4. Only after green tests, start C1b/C2 for file/git/task gates.
