# Cloudflare-tunnel actor resolution — design

> **Status:** validated 2026-05-29. Fixes the prod lockout caused by promoting C1a→C2 to prod (commit `cc753c0`), where `cloudflare-tunnel` mode + `CF_ACCESS_REQUIRED=0` resolved to no actor → 401 on every host-access op (terminal create, doctor). Prod was rolled back to C0 (`4fe4041`); this design lets C1/C2 reach prod safely.

## Problem

`resolveActorFromAccessPayload` (`backend/services/foundation-actors.ts`) has only two outcomes when no verified Cloudflare Access JWT payload is present:

1. dev/CI legacy mode → anonymous actor, or
2. otherwise → **401 `cloudflare_access_required`**.

Prod runs `DECKTERM_PUBLISH_MODE=cloudflare-tunnel`, `CF_ACCESS_REQUIRED=0`, `HOST=127.0.0.1`, with no dev flags. The edge (Cloudflare Access) authenticates the human, but the app does not verify the JWT in tunnel mode, so there is no `accessPayload` → branch 2 → 401 everywhere. Web shell (static) loads; every foundation-gated action fails.

Authorization compounds it: even if actor resolution returned an actor, `requireFoundationCapability` (`server.ts:787`) requires a scoped grant; an arbitrary per-user email actor has none → 403.

**Root lesson:** the deploy smoke test uses `DECKTERM_LEGACY_NO_BOOTSTRAP` bypass, so it never exercised prod's real auth mode. Tests for this fix MUST run in prod-like mode (no dev/CI flags).

## Model — "edge-trusted" tunnel mode

In `cloudflare-tunnel` mode the edge already gate-kept the human. The app **trusts the edge on both layers** (actor resolution + authorization) but **records the real identity** for audit/accountability.

Security invariant: trusting the `Cf-Access-Authenticated-User-Email` header without JWT verification is valid only because prod binds `HOST=127.0.0.1` — the app is reachable only through the tunnel, which always sets the header. Direct access (and thus header spoofing) is impossible. The doctor warns if tunnel mode is used with a non-loopback `HOST`.

## Changes

### 1. `backend/services/foundation-actors.ts`

- Add `DeckTermActor["source"]` values `"cloudflare_tunnel"` and `"tunnel_default"`.
- Extend signature: `resolveActorFromAccessPayload({ accessPayload, tunnelUserEmail, env })`.
- Add helper `isEdgeProtectedTunnelMode(env)` = `env.DECKTERM_PUBLISH_MODE === "cloudflare-tunnel"`.
- Branch order:
  1. verified `accessPayload` (sub+email) → `cloudflare_access` (unchanged).
  2. **tunnel mode** → `tunnelUserEmail` present → `{ id: email, email, source: "cloudflare_tunnel" }`; else `{ id: "tunnel", email: "tunnel", source: "tunnel_default" }` + `console.warn` (never 401).
  3. existing dev/CI legacy → anonymous (unchanged).
  4. else → 401 (unchanged — strict `cloudflare`/`cloudflare-access` keep current behavior).

### 2. `backend/services/foundation-authorization.ts`

- Export `isEdgeTrustedTunnelMode(env)` (purely `cloudflare-tunnel`; no dev conditions).
- `authorizeTerminalSessionAccess` gains an edge-trusted branch → `{ allow: true, reason: "edge_trusted_tunnel" }`.

### 3. `backend/server.ts`

- `getCurrentActor(c)` (HTTP): pass `c.req.header("cf-access-authenticated-user-email")` as `tunnelUserEmail`.
- WS auth (~line 1145): pass `req.headers.get("cf-access-authenticated-user-email")`.
- `requireFoundationCapability` (line 802): right after the `isFoundationLegacyBypassEnabled()` check, add:
  `if (isEdgeTrustedTunnelMode(process.env)) { writeAuditEvent(state.db, { actorUserId, action: capability, resourceType, resourceId, decision: "allow", reason: "edge_trusted_tunnel", data }); return { ok: true }; }`
  — allow, but write an audit row carrying the real email.

### 4. `backend/onboarding-doctor.ts` (defense-in-depth)

- New check: `cloudflare-tunnel` + non-loopback `HOST` → `warning` ("edge-trust of the header is only safe behind a loopback bind").

No new tables, no migration. Audit log reused.

## Tests (TDD — the gap that broke prod)

All new cases run in **prod-like mode** (no `DECKTERM_RUNTIME_ENV`/`CI`/`NODE_ENV=test` shortcuts for the behavior under test).

1. `foundation-actors.test.ts`:
   - tunnel + header → email actor, `source: "cloudflare_tunnel"`.
   - tunnel + no header → `tunnel` default actor (not 401).
   - `cloudflare`/`cloudflare-access` + no identity → still 401 (regression guard).
2. `foundation-authorization.test.ts`: `isEdgeTrustedTunnelMode` true only for `cloudflare-tunnel`; edge-trust does not touch strict modes.
3. `foundation-c2.test.ts` (or new): end-to-end in tunnel mode — terminal create / file access passes and writes an `edge_trusted_tunnel` audit row with the email.
4. Register any new test files in `package.json` `test:unit`.

## Deploy safety

1. Work on `dev` (4174); `test:unit` green.
2. Tunnel branch can't be exercised live on dev (dev runs the legacy bypass) → cover it with an env-override local check (curl with/without the header) plus the unit tests.
3. `dev → main` only after green. **After deploy, verify LIVE** (journalctl + user confirms terminal create on prod) before claiming done. `main` stays frozen on the broken `cc753c0` deploy until this lands and is verified.
