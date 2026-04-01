# DeckTerm Operations Guide

## Purpose

This document describes the current operational model of DeckTerm as it exists today.

It covers:

- repository branches
- local server checkouts
- systemd services
- GitHub Actions
- release layout
- deployment and rollback

## Branch and Environment Model

Git model:

- `feature/*` for isolated work
- `dev` for integration
- `main` for production

Runtime model:

- `4174` is development
- `4173` is production

## Server Layout

### Development runtime

- checkout: [`/home/deploy/deckterm_dev`](/home/deploy/deckterm_dev)
- branch: `dev`
- service: `deckterm-dev.service`

### Production runtime

Production is deployed into release directories and served through a stable symlink:

```text
/home/deploy/apps/deckterm/
├── incoming/
├── prod/
│   ├── current -> /home/deploy/apps/deckterm/prod/releases/<sha>
│   ├── previous -> /home/deploy/apps/deckterm/prod/releases/<sha>
│   ├── releases/
│   └── shared/
└── shared/
    └── prod.env
```

The production service reads:

- code from `prod/current`
- environment from `/home/deploy/apps/deckterm/shared/prod.env`

The legacy checkout [`/home/deploy/deckterm`](/home/deploy/deckterm) is not the production runtime source anymore.

## Systemd Services

### Production

Service file: [`/home/deploy/.config/systemd/user/deckterm.service`](/home/deploy/.config/systemd/user/deckterm.service)

Key properties:

- user-level systemd
- working directory is the `current` release symlink
- explicit Bun path in `ExecStart`
- `TMUX_BACKEND=1`

### Development

Service file: `deckterm-dev.service`

Key properties:

- runs from [`/home/deploy/deckterm_dev`](/home/deploy/deckterm_dev)
- used for all active browser testing on `4174`

## GitHub Actions

### CI

Workflow: [`.github/workflows/ci.yml`](/home/deploy/deckterm_dev/.github/workflows/ci.yml)

Runs on:

- pushes to `main`, `dev`, `feature/**`, `fix/**`, `chore/**`
- PRs to `main` and `dev`

Jobs:

- `unit`
- `smoke-e2e`

### Deploy Main

Workflow: [`.github/workflows/deploy-main.yml`](/home/deploy/deckterm_dev/.github/workflows/deploy-main.yml)

Behavior:

1. verify-and-package
   - install dependencies
   - run unit tests
   - start DeckTerm on `4174`
   - run smoke E2E
   - build release tarball
2. deploy
   - gated by `ENABLE_PROD_DEPLOY=1`
   - downloads artifact
   - copies it over SSH
   - expands to incoming release directory
   - runs deploy script on the server

### Promote Dev To Main

Workflow: [`.github/workflows/promote-dev-to-main.yml`](/home/deploy/deckterm_dev/.github/workflows/promote-dev-to-main.yml)

Behavior:

- creates or updates a promotion PR from `dev` to `main`
- can optionally enable auto-merge

## GitHub Configuration

### Secrets

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

### Variables

- `ENABLE_PROD_DEPLOY=1`
- `DEPLOY_PORT`
- `DEPLOY_ROOT`
- `PROD_PORT`
- `PROD_CANDIDATE_PORT`
- `PROD_SERVICE`

### Branch protections

Recommended and currently used model:

- `dev`
  - PR required
  - `unit` and `smoke-e2e` required
- `main`
  - PR required
  - `unit` and `smoke-e2e` required
  - one approval required

## Deployment Script Behavior

Primary script: [scripts/deploy_release.sh](/home/deploy/deckterm_dev/scripts/deploy_release.sh)

Current deployment flow:

1. copy unpacked source into a versioned release directory
2. symlink shared env file
3. install dependencies inside the release
4. start a candidate instance on `PROD_CANDIDATE_PORT`
5. wait for candidate health
6. repoint `current` symlink
7. restart production systemd service
8. verify live health on `PROD_PORT`
9. rollback to `previous` on failure

Important hardening already in place:

- startup failures exit non-zero instead of leaving a fake alive process
- SSH deploy key is written with trailing newline
- deploy script uses an explicit Bun path for non-interactive SSH shells

## Rollback

Rollback script: [scripts/rollback_release.sh](/home/deploy/deckterm_dev/scripts/rollback_release.sh)

Example:

```bash
DEPLOY_ROOT=/home/deploy/apps/deckterm/prod \
SYSTEMD_SERVICE=deckterm.service \
bash scripts/rollback_release.sh
```

## Validation Commands

### Local development validation

```bash
bun run test:unit
bun run test:e2e:smoke
bun run test:e2e:workspace
```

### Service health

```bash
curl http://127.0.0.1:4174/api/health
curl http://127.0.0.1:4173/api/health
systemctl --user status deckterm-dev.service
systemctl --user status deckterm.service
```

## Known Operational Notes

- Production now deploys cleanly from `main` via GitHub Actions
- `deckterm.service` is the production service name
- browser tests target `4174`
- stale local git checkouts can exist without affecting runtime because production runs from release directories

## Recommended Team Workflow

1. Work in `feature/*` or directly on `dev`
2. Validate behavior on `4174`
3. Merge to `dev`
4. Promote `dev` to `main`
5. Let `Deploy Main` verify and deploy automatically
