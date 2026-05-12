# DeckTerm Comparable Projects Research — May 2026

> Purpose: avoid reinventing the wheel while keeping DeckTerm's immediate scope small.
>
> Recommendation: do **not** turn DeckTerm into Coder/Daytona/OpenHands now. Borrow proven patterns for auth/bootstrap, root scoping, tmux persistence, run profiles, dirty workspace guard, artifacts, mobile QOL and design.

## Current DeckTerm context

DeckTerm already has:

- Bun + Hono backend
- Bun WebSocket + Bun.Terminal
- vanilla JS + xterm.js frontend
- tmux-backed persistent terminals
- mobile controls
- file explorer
- git panel/APIs
- Cloudflare Access guards
- setup/onboarding doctor
- supervised task runner surface

Immediate implementation direction remains small:

```text
C0: bootstrap gate + authorized terminal create/attach path
C1: auth identities + real grants resolver + route capability registry
C2: compatibility bridge + file/git gates + setup doctor hardening
```

## Projects reviewed

### Web terminal / remote shell

- ttyd — https://github.com/tsl0922/ttyd
- WeTTY — https://github.com/butlerx/wetty
- GoTTY — https://github.com/yudai/gotty
- Apache Guacamole — https://github.com/apache/guacamole-client
- Teleport — https://github.com/gravitational/teleport

### Browser IDE / remote dev workspace

- code-server — https://github.com/coder/code-server
- OpenVSCode Server — https://github.com/gitpod-io/openvscode-server
- Coder — https://github.com/coder/coder
- DevPod — https://github.com/loft-sh/devpod
- Daytona — https://github.com/daytonaio/daytona
- Gitpod — https://github.com/gitpod-io/gitpod

### Agent/work orchestration

- OpenHands — https://github.com/All-Hands-AI/OpenHands
- Aider — https://github.com/Aider-AI/aider
- SWE-agent — https://github.com/SWE-agent/SWE-agent

## Project-by-project takeaways

### ttyd

Borrow:

- WebSocket origin checking.
- Simple reverse-proxy/auth-header deployment compatibility.
- Terminal-focused product restraint.

Do not borrow:

- A purely stateless “serve a command over the web” mental model. DeckTerm already has richer workspace/session needs.

### WeTTY

Borrow:

- Simple browser terminal UX and deployment mental model.

Do not borrow:

- SSH-first assumptions as the core product model. DeckTerm is closer to a trusted local/server cockpit over approved project roots.

### GoTTY

Borrow:

- Explicit distinction between read-only and write-enabled terminal access.
- Random URL/token-ish lightweight access ideas only as temporary bootstrap inspiration.

Do not borrow:

- Treat random URL as sufficient long-term auth.
- Expose write shell without a separate explicit grant.

### Apache Guacamole

Borrow:

- Conceptual separation of audit/session metadata from live protocol transport.
- Optional recording/replay as a future policy-controlled feature.

Do not borrow:

- Full remote desktop gateway architecture.
- Session recording by default; it creates privacy/compliance and secret-leak risk.

### Teleport

Borrow:

- Strong framing: identity, audit, least privilege, session metadata.

Do not borrow:

- Full certificate/access-proxy/session-recording platform. It is too heavy for DeckTerm’s near-term scope.

### code-server

Borrow:

- First-run config/password/token pattern.
- Health endpoints and operational diagnostics.
- Port preview/proxy UX pattern.
- Mobile/PWA lessons, especially keyboard/clipboard/Safari quirks.

Do not borrow:

- Full IDE surface as a target. DeckTerm should remain terminal/work cockpit, not VS Code replacement.

### OpenVSCode Server

Borrow:

- Connection-token/token-file style first-run bootstrap pattern.
- Clear startup output for how to connect securely.

Do not borrow:

- Treating editor workspace as the primary surface. DeckTerm’s primary surface remains terminal/session/task cockpit.

### Coder

Borrow:

- Workspace/template separation as a mental model.
- Auto-start/auto-stop/TTL as future QOL ideas.
- User/workspace secrets scoping as future inspiration.

Do not borrow:

- Terraform templates/provisioning as a core dependency.
- Multi-tenant enterprise RBAC before DeckTerm’s local/server foundation is stable.

### DevPod

Borrow:

- `devcontainer.json` as the future environment standard.
- Provider abstraction as a later idea: local Docker, remote VM, Kubernetes.

Do not borrow:

- A full client/provider ecosystem now.
- A custom environment spec when devcontainers already exist.

### Daytona

Borrow:

- Clear sandbox lifecycle vocabulary: create/start/stop/destroy.
- Snapshot/prebuild mental model for later isolated runs.
- Resource/network policy ideas for future agent environments.

Do not borrow:

- Sandbox cloud/fleet as a primary primitive.
- Custom hosted runner platform before local root security is solved.

### Gitpod / Codespaces patterns

Borrow:

- Devcontainer standard.
- Account/project/repo-scoped secrets.
- Prebuilds/snapshots as later acceleration.

Do not borrow:

- Cloud workspace platform scope.
- Heavy prebuild infrastructure as a near-term requirement.

### OpenHands

Borrow:

- Sandbox abstraction and lifecycle as future inspiration.
- Separation between agent orchestration and execution environment.

Do not borrow:

- Full agent server architecture.
- Docker sandboxing as a blocking dependency for C0/C1.
- Multi-user agent orchestration before basic bootstrap/root/terminal safety is solid.

### Aider

Borrow:

- Dirty workspace safety.
- Clear modes: ask/code/architect/review-style flows.
- Checkpoint/undo mental model.
- Strong git awareness before agent changes.

Do not borrow:

- Deep repo-map/indexing as an immediate DeckTerm requirement.
- Automatic commit/stash behavior before the UX is explicit and audited.

### SWE-agent

Borrow:

- Run configuration concept.
- Trajectory/run record idea: prompt, action/output, exit state, logs, artifacts.
- Replay/debug as future inspiration.

Potential concrete reuse:

- Define DeckTerm run profiles as a **SWE-agent-compatible subset where practical**, rather than inventing a totally new format.
- Start with fields that map cleanly to DeckTerm:
  - profile name,
  - command,
  - args,
  - cwd/root,
  - env allowlist,
  - prompt/input,
  - timeout,
  - output/artifact paths.

Do not borrow:

- SWE-bench/evaluation/batch-runner infrastructure for early DeckTerm.
- Complex trajectory inspector before simple run history exists.

## What to borrow now

### 1. First-run bootstrap like code-server/OpenVSCode

Patterns:

- code-server generates config/password on first run and supports reverse-proxy auth.
- OpenVSCode Server can use a connection token/token file and prints an authenticated URL.
- ttyd/GoTTY support basic/reverse-proxy style auth and origin checks.

DeckTerm takeaway:

- Keep first-admin bootstrap simple and explicit.
- Env admin for Cloudflare Access deployments.
- One-time token fallback for local/self-hosted.
- Token must be short-lived/consumed and not become long-term auth.
- Setup doctor should show bootstrap state clearly.

### 2. Origin and WebSocket safety like ttyd/GoTTY

Patterns:

- ttyd has origin checking.
- GoTTY distinguishes read-only terminal vs write-enabled terminal; write access is explicit.

DeckTerm takeaway:

- Add WebSocket origin checks.
- Treat host terminal write access as an explicit grant.
- In UI, label host terminal as powerful/unsafe compared to future container-scoped execution.

### 3. Tmux/screen persistence is still the right base

Patterns:

- ttyd/GoTTY commonly recommend tmux/screen for persistent/shared sessions.
- code-server has heartbeat/reconnect/health behavior.

DeckTerm takeaway:

- DeckTerm's tmux-backed design is good; don't replace it.
- Improve session state vocabulary: attached, detached, reconnecting, stale.
- Add heartbeat/last-activity metadata and graceful reconnect indicators.

### 4. Setup doctor as a product surface

Patterns:

- code-server has health endpoints and operational docs.
- Coder/DevPod/Gitpod have first-run workspace/template flows.

DeckTerm takeaway:

- Setup should be a checklist with concrete fixes:
  - Cloudflare Access detected/configured
  - admin bootstrapped
  - state dir writable
  - SQLite DB available
  - tmux available
  - shell available
  - registered roots exist
  - git available
  - WebSocket origin/trusted origins configured

### 5. Project roots/workspaces from Coder/DevPod, but lighter

Patterns:

- Coder has templates/workspaces.
- DevPod/Gitpod use `devcontainer.json` and lifecycle hooks.
- Daytona has sandbox lifecycle and snapshots.

DeckTerm takeaway:

- Do not build a full workspace platform now.
- Use a light registry:
  - project root,
  - optional project label,
  - environment/access type.
- Later, reuse `devcontainer.json` rather than inventing a custom environment spec.

### 6. Dirty workspace guard from Aider

Patterns:

- Aider is strong on git safety: dirty-file awareness, commits, undo/checkpoint-like flows, clear modes.

DeckTerm takeaway:

- Before agent/task runs, show branch + dirty status + diff summary.
- Offer cancel / continue with audit / checkpoint later.
- Do not implement automatic worktree/stash magic first.

### 7. Run profiles and trajectories from SWE-agent/Aider/Coder Agents

Patterns:

- SWE-agent has run configuration YAML, trajectories, replay/debug.
- Aider has modes like ask/code/architect.
- Coder Agents separate workspace provisioning from task execution.

DeckTerm takeaway:

- Future agent runs should be command-template run profiles first, not native adapters.
- Prefer a SWE-agent-compatible subset where it fits.
- Store run records:
  - prompt/task,
  - profile,
  - cwd/root,
  - stdout/stderr,
  - exit code,
  - git before/after summary,
  - artifacts.
- Replay/inspector can come much later.

### 8. Artifacts/logs from SWE-agent/Daytona/Guacamole/Teleport

Patterns:

- SWE-agent stores trajectories.
- Daytona streams task logs.
- Guacamole/Teleport have session recording/audit concepts.

DeckTerm takeaway:

- Start with metadata and safe summaries, not full terminal recording.
- Store audit separately from run logs/transcripts.
- Full transcript/session replay should be policy-controlled.

### 9. Secrets scopes from Coder/Codespaces/Gitpod

Patterns:

- Secrets are scoped to account/org/repo/workspace and injected as env vars.

DeckTerm takeaway:

- Do not put secrets into project files or long-term logs.
- For early run profiles, use explicit env allowlists and redaction.
- Later add local encrypted secrets + provider adapters.

### 10. Mobile QOL from code-server/iPad usage and terminals

DeckTerm already has:

- Mobile controls
- Extra keys/paste affordances
- File/Git mobile surfaces
- Focus recovery work

Borrow additionally:

- PWA/add-to-home-screen docs and tested flows.
- Safari/WebKit caveat handling and visible help.
- Explicit `Ctrl+C` soft key/action.
- Better keyboard shortcut discoverability on mobile.

Do not duplicate work:

- Do not rebuild the mobile toolbar from scratch if the existing one is working.
- Tighten and document the current mobile controls instead.

## Recommended QOL/design ideas for DeckTerm

### High ROI soon

1. **Instance/root/env badges**
   - Show current instance mode: dev/prod/insecure local.
   - Show active root and host/container access type.

2. **Command palette as primary power UX**
   - New terminal
   - Reconnect session
   - Open Files/Git
   - Copy cwd
   - Run setup doctor
   - Add preview port
   - Create task/run profile later

3. **Port previews**
   - Inspired by code-server proxy routes.
   - Start with manual “add preview port” and detected open ports.

4. **Session recovery panel**
   - Show tmux sessions, last activity, cwd, branch, agent process hint.
   - Attach / kill / rename / duplicate.

5. **Status-first Git panel**
   - Branch, dirty count, staged/unstaged, quick diff, pull/push with confirm.

6. **Setup doctor improvements**
   - Treat setup as a live checklist, not hidden diagnostics.
   - Each failing row should include exact env var/config suggestion.

### Later

7. **Run history UI**
   - Status, duration, profile, exit code, branch, logs/artifacts.

8. **Snapshot-lite through Git**
   - Checkpoint commit/stash/restore helper before agent runs.

9. **`deckterm.json` or `.deckterm/` metadata**
   - Project display name, default root, preview ports, recommended profiles.

10. **Devcontainer detection**
   - If `.devcontainer/devcontainer.json` exists, show it and later offer container execution.

## Scope-creep traps to avoid

- From OpenHands: do not import a full agent server architecture.
- From Coder: do not import template/provisioning/Terraform as core DeckTerm concepts.
- From Daytona: do not make sandbox lifecycle the primary primitive before local root/terminal safety is done.
- From Teleport/Guacamole: do not enable full session recording by default.
- From code-server/OpenVSCode: do not turn DeckTerm into an IDE clone.
- From SWE-agent: do not start with batch evaluation/replay tooling.
- From DevPod/Gitpod: do not invent a custom env spec; reuse devcontainers later.

## What not to build before C0/C1/C2 are functional

- Coder-style templates/provisioning
- Daytona-style cloud sandbox fleet
- OpenHands-like full agent server
- SWE-agent-style batch/eval/replay platform
- Full IDE/editor replacement
- Full session replay/recording by default
- Advanced secrets manager UI
- Docker/devcontainer execution as a blocking dependency

## Practical recommendation

DeckTerm should position the next slice as:

> A trusted cockpit over approved project roots: safe bootstrap, known actor, known root, authorized host terminal, tmux persistence, WebSocket attach gate, audit metadata, and good recovery UX.

After that, borrow from Aider/SWE-agent/Coder/Daytona incrementally:

1. dirty workspace guard
2. run profiles, preferably SWE-agent-compatible where practical
3. run history/artifacts
4. env allowlist/secrets redaction
5. devcontainer/Docker execution
6. richer agent orchestration
