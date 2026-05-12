# DeckTerm Foundation Decisions — May 2026

> Status: discovery frozen. Use this as roadmap context, not as permission to build the whole thing at once.
>
> Immediate build direction is **safe, mergeable foundation slices**, starting with **C0: bootstrap gate + authorized terminal create/attach path**.

## Context

This document preserves the product/architecture decisions from the DeckTerm review session so the effort is not lost. The original goal was to inspect the current DeckTerm codebase, identify what is strong, what is unfinished, and recommend practical next steps.

Important correction from the session:

> Do not rewrite DeckTerm. Strengthen the current working product with small, functional, security-oriented slices.

Current active checkout at time of review:

- Dev repo: `/home/deploy/deckterm_dev`
- Branch: `dev`
- Runtime: Bun + Hono + Bun WebSocket + Bun.Terminal + vanilla JS/xterm.js
- Dev port: `4174`
- Production port: `4173`

## What is already good

DeckTerm already has useful product surface area:

- Persistent tmux-backed web terminals
- Floating/split workspace terminal UI
- Mobile controls and clipboard affordances
- File explorer under allowed roots
- Git panel/APIs
- Cloudflare Access guards
- Setup/onboarding doctor
- Supervised task runner surface
- Dev/prod deployment split with release-based production deployment
- Unit and Playwright test scripts

The main gap is not terminal functionality. The main gap is that DeckTerm is a powerful host-shell/filesystem tool and needs a clearer security/domain foundation.

## Scope decision

### Build now, but split into mergeable slices

The earlier “Milestone C” was too broad as a single vertical slice. Implement it as C0/C1/C2:

### C0 — smallest mergeable safety slice

Goal: prevent unauthenticated/unbootstrapped host terminal access without refactoring the whole app.

```text
fresh/prod-ish startup
  -> state DB/migration init
  -> bootstrap gate
  -> env-admin OR one-time token bootstrap
  -> import/resolve one approved root minimally
  -> guard POST /api/terminals
  -> guard WS /ws/terminals/:id upgrade/attach
  -> write minimal audit row for allow/deny
```

C0 must be small enough to merge quickly. Prefer hard-coded/minimal checks over a broad framework where that avoids churn.

### C1 — real domain shape

```text
auth_identities
real scoped grants resolver
route capability registry
authorized actor resolution
terminal session metadata
```

### C2 — compatibility and migration hardening

```text
ALLOWED_FILE_ROOTS -> project_roots import hardening
legacy path-to-root compatibility bridge
file/git endpoint gates
richer audit events
setup doctor remediation rows
```

### Do not build now

Explicitly defer:

- Full permission editor UI
- Secrets manager
- Agent adapters
- Full task/run/event-log redesign
- Artifacts auto-collection
- Docker/shared/isolated execution environments
- Transcript policy UI
- Postgres/S3 storage
- Stable public REST API guarantees

## C0 acceptance scenario

Milestone C0 is done only when this scenario is executable and tested:

1. Start with a fresh state dir and production-like config, with insecure dev mode **not** enabled.
2. `POST /api/terminals` is blocked before bootstrap.
3. `WS /ws/terminals/:id` upgrade/attach is blocked before bootstrap or without an authorized terminal/session.
4. Bootstrap first admin via either:
   - matching Cloudflare Access env admin identity, or
   - one-time token fallback.
5. Register/import one allowed root from `ALLOWED_FILE_ROOTS` or explicit setup input.
6. Create an authorized terminal in that root.
7. Attach to the terminal over WebSocket from an allowed origin.
8. Audit rows contain at least: actor, root, terminal/session id, action, allow/deny, reason, timestamp.
9. Attempts to use `/` as root fail unless an explicit override is present.
10. Broad `$HOME` root import emits a warning/state flag.

## Existing production migration story

Turning on bootstrap gates can lock out an existing deployment if no admin user exists yet. C0 must include one explicit migration path:

### Preferred: auto-bootstrap from existing Cloudflare Access identity

If all are true:

- no admin users exist,
- `CF_ACCESS_REQUIRED=1`,
- request has a valid Cloudflare Access identity,
- identity matches `DECKTERM_BOOTSTRAP_ADMIN_EMAIL`,

then the setup/bootstrap endpoint can create the first admin and immediately consume bootstrap mode.

### Temporary escape hatch for existing deployments

Allow a temporary flag only for controlled migration:

```env
DECKTERM_LEGACY_NO_BOOTSTRAP=1
```

Rules:

- print a loud startup warning,
- expose a setup doctor warning,
- do not allow this flag to be the documented long-term default,
- require removing it after first admin/bootstrap is complete.

If this flag is not implemented, the release notes must provide a precise manual bootstrap path before enabling the gate in production.

## Grant model shape

Use concrete tuple-like grants rather than vague strings only.

Suggested MVP schema:

```text
grants(
  id,
  user_id,
  action,          -- e.g. server.admin, terminal.create, root.access, execution.host
  resource_type,   -- server | root | environment | terminal | route
  resource_id,     -- *, root id, env id, etc.
  granted_by,
  granted_at,
  expires_at nullable
)
```

Resolver contract:

```text
can(user, action, resource_type, resource_id, context) -> allow | deny + reason
```

C0 may implement a minimal hard-coded server-owner/admin check, but the code should be shaped so C1 can replace it with the resolver without touching every route.

## Directory structure

Keep infra and domain/services separate:

```text
backend/foundation/
  config.ts
  db.ts
  migrations.ts

backend/services/
  bootstrap.ts
  auth.ts
  grants.ts
  roots.ts
  audit.ts
  policies.ts
```

Route handlers should stay thin and call services. Do not put durable domain logic directly into `server.ts` beyond a small bridge during the strangler migration.

## C0/C1/C2 checklist

### C0 checklist

1. Add SQLite DB open/init and first migration.
2. Add minimal tables: `users`, `project_roots`, `terminal_sessions`, `audit_events`.
3. Add minimal bootstrap status service.
4. Add env-admin preferred bootstrap and token fallback.
5. Add bootstrap token security:
   - store under `$DECKTERM_STATE_DIR/bootstrap-token`,
   - file mode `0600`,
   - single use,
   - TTL, default `1h`,
   - delete/consume after success,
   - warn/fail if token file is world-readable,
   - state dir must be gitignored/outside repo by default.
6. Add hard guard for insecure dev escape hatch:
   - `DECKTERM_DEV_INSECURE_LOCAL_ADMIN=1` only works for explicit dev/local mode,
   - ignore/fail if `NODE_ENV=production`, Cloudflare Access is required, or bind is non-localhost unless an additional explicit override is set.
7. Import/resolve one allowed root from `ALLOWED_FILE_ROOTS` or setup input.
8. Enforce root guard in code:
   - never import `/` without explicit `DECKTERM_ALLOW_ROOT_FILESYSTEM=1`,
   - flag broad `$HOME` roots,
   - canonicalize real paths,
   - reject missing roots for terminal create.
9. Guard `POST /api/terminals` through bootstrap + actor + root check.
10. Guard `WS /ws/terminals/:id` upgrade/attach through origin + actor/session/root check.
11. Write audit allow/deny rows for terminal create and attach attempts.
12. Keep existing terminal/tmux behavior working.
13. Add C0 tests for the acceptance scenario above.

### C1 checklist

1. Add `auth_identities` table.
2. Add `grants` table using the tuple shape above.
3. Add real grant resolver service.
4. Add route capability registry for host-access routes.
5. Persist richer terminal session metadata.
6. Replace C0 hard-coded admin checks with resolver calls.

### C2 checklist

1. Add compatibility bridge for legacy path-only file/git calls.
2. Gate file/git/task host-access endpoints using actor/root resolution.
3. Add deprecation telemetry/audit-lite for legacy path-only root resolution.
4. Add setup doctor rows for bootstrap/root/auth/WebSocket/origin/state DB issues.
5. Add transcript policy placeholder only where it is actually consumed.

## DB schema scope

Do not create empty future tables just because the architecture mentions them.

### C0 tables

```text
users
project_roots
terminal_sessions
audit_events
```

### C1 tables

```text
auth_identities
grants
```

### C2/later tables only when used

```text
workspaces
projects
environments
policies
tasks
runs
run_events
artifacts
secrets
```

Single-workspace assumption is acceptable for MVP. Avoid skeleton tables that create migration debt before real usage is known.

## Decision log

### 16. Admin bootstrap

Decision: **Hybrid — env admin OR one-time bootstrap token. Production must not allow terminal/host access before admin bootstrap.**

- Env admin path for Cloudflare/server deployment.
- Token file fallback for local/self-hosted setup.
- Dev escape hatch allowed only via explicit insecure local mode and hard guarded against production use.

### 17. Permission model

Decision: **UI presets, internally scoped grants.**

- UI shows simple presets like Server owner, Trusted developer, Restricted agent, Viewer.
- Internally use concrete grants with action + resource type + resource id.
- Every sensitive action eventually goes through `can(user, action, resource, context)`.

### 18. Primary work unit

Decision: **Hybrid — quick terminals plus task-based workflow.**

- Quick terminal remains low-friction.
- Tasks become the structured workflow for agent/human work with history and outcome.
- Terminal sessions may be attached to a task or standalone.

### 19. Transcript/history model

Decision: **Policy-based, defaulting to structured command history + limited output.**

- Support modes: `none`, `commands`, `full`.
- Default should be command history, limited output, strict redaction, retention.
- Full transcript only explicit and audited.
- Not part of C0 except leaving a future seam.

### 20. Secrets model

Decision: **Hybrid — local encrypted secrets first, provider adapters later.**

- MVP can eventually store encrypted local workspace/project secrets.
- Later adapters: 1Password, Vault, Doppler, Cloudflare, Kubernetes, SOPS.
- Not part of C0/C1.

### 21. Agent/executor model

Decision: **Hybrid — command-template run profiles first, native adapters later.**

- First run agents as controlled CLI command profiles.
- Later add native adapters for Claude/Codex/OpenCode/Hermes.
- Avoid shell-string interpolation; spawn command + args with `shell: false`.
- Not part of C0/C1.

### 22. Artifacts/output model

Decision: **Hybrid — explicit artifacts + safe auto-collection policy.**

- Eventually collect exit code, duration, git status/diff stat, changed files, test reports.
- Full diff should be policy-controlled.
- Not part of C0/C1.

### 23. Project roots/filesystem scope

Decision: **Hybrid by execution mode, but project root registry is mandatory.**

- Every terminal/task/run has a registered root.
- Host mode is a soft boundary and power-user feature.
- Containers later provide stronger filesystem boundaries.
- C0 implements only host mode over an approved root.

### 24. Dirty workspace safety

Decision: **Run isolation policy: dirty guard + snapshot/isolated options, MVP as C+.**

- Quick terminal: warn on dirty repo.
- Agent/task run: require explicit choice if dirty.
- Do not implement automatic worktree/stash magic first.
- Not part of C0.

### 25. State/config storage

Decision: **Storage adapter — SQLite default, Postgres later.**

- Default state dir contains `deckterm.db`, optional `artifacts/`, and bootstrap token.
- Artifacts stored on filesystem later; DB stores metadata.
- Postgres/S3/R2 can come later.

### 26. Deployment/runtime model

Decision: **Dual mode — direct host dev + Docker server deployment.**

- Direct host mode for local/dev/power-user.
- Docker server mode for self-hosted deployment with explicit mounts and optional Docker socket.

### 27. Config hierarchy

Decision: **defaults < config file < env vars < CLI flags + config doctor.**

- Add effective config printing with redaction later.
- Setup doctor should include state dir, DB, auth, roots, WebSocket origin/trusted origins.

### 28. API/frontend boundary

Decision: **Hybrid — internal typed UI API + stable-ish core REST/events for automation.**

- Domain logic lives in services, not route handlers.
- Core automation endpoints can be `/api/v1 alpha` later.
- C0 only needs to avoid burying security logic in handlers.

### 29. Event/log streaming

Decision: **Append-only event log as source of truth + SSE/WS transports.**

- SSE for read-only run/task events.
- WebSocket for interactive terminal.
- Polling fallback from event log.
- Not part of C0 beyond audit rows.

### 30. First implementation milestone

Decision updated: **split the original Milestone C into C0/C1/C2.**

- C0: bootstrap gate + authorized terminal create/attach.
- C1: auth identities + grants + route registry.
- C2: compatibility bridge + file/git gates + setup doctor hardening.

### 31. Implementation strategy

Decision: **Strangler refactor: foundation infra + services + gradual route migration.**

First migrated paths:

```text
POST /api/terminals
WS   /ws/terminals/:id
```

### 32. Bootstrap gate hardness

Decision: **Mode-dependent bootstrap gate + route capability registry, phased.**

- C0: hard-code gate for terminal create/attach and setup/health allowlist.
- C1: route capability registry.
- Production/default blocks host-access routes before bootstrap.
- Dev escape hatch is explicit and production-guarded.

### 33. First admin bootstrap specifics

Decision: **Env admin preferred, token fallback, explicit auth identity binding.**

- If env admin configured, create first admin only from matching authenticated provider identity.
- Otherwise generate one-time bootstrap token file.
- `auth_identities` lands in C1 unless C0 implementation naturally needs it.

### 34. DB schema

Decision updated: **trim first slice schema.**

- C0: `users`, `project_roots`, `terminal_sessions`, `audit_events`.
- C1: `auth_identities`, `grants`.
- Later only when consumed: `workspaces`, `projects`, `environments`, `policies`, `tasks`, `runs`, `run_events`, `artifacts`, `secrets`.

### 35. Default workspace/project/root behavior

Decision: **Hybrid — import `ALLOWED_FILE_ROOTS` + dev cwd fallback, with code-level guards.**

- Import existing `ALLOWED_FILE_ROOTS` into DB project roots.
- If no roots and insecure dev mode, seed `process.cwd()`.
- In production with no roots, setup should ask to register a root.
- Never import `/` without explicit override.
- Warn/flag broad `$HOME` roots.

### 36. Mapping old `ALLOWED_FILE_ROOTS` to new `project_roots`

Decision: **Compatibility bridge + deprecation telemetry for path-only legacy calls, but not in C0.**

- Import env roots into DB roots.
- Legacy file/git endpoints can still accept paths temporarily.
- Backend resolves path to effective DB root + actor grants in C2.
- Emit telemetry/audit-lite for legacy path-only resolution so UI can migrate later.

## Recommended next action

Stop discovery and write/execute a focused implementation plan for **C0 only**. Treat C1/C2 and all broader decisions as backlog context.
