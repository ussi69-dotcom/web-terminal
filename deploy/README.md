# Deploy Layout

This repo is set up for a `feature/* -> dev -> main` workflow:

- `dev` is the integration branch
- `main` is production-ready
- GitHub Actions validates every push and pull request
- `main` can deploy atomically over SSH once repository secrets and variables are configured

## Recommended server layout

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

`prod.env` should contain the runtime environment for the production service, including `PORT=4173`.

## GitHub configuration

Repository secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`

Repository variables:

- `ENABLE_PROD_DEPLOY=1` to enable live production deployment
- `DEPLOY_PORT` default `22`
- `DEPLOY_ROOT` default `/home/deploy/apps/deckterm`
- `PROD_PORT` default `4173`
- `PROD_CANDIDATE_PORT` default `4273`
- `PROD_SERVICE` default `deckterm-prod.service`

Recommended branch protections:

- `dev`: require PRs plus passing `unit` and `smoke-e2e`
- `main`: require PRs, passing `unit` and `smoke-e2e`, and at least one approval

Local helper:

```bash
GITHUB_PERSONAL_ACCESS_TOKEN=... \
bash scripts/configure_github_branch_protection.sh
```

## Rollout

1. Push feature branches and merge them into `dev`.
2. Let CI validate `dev`.
3. Run `Promote Dev To Main` or open a PR from `dev` to `main`.
4. Merge that PR once checks pass.
5. `Deploy Main` packages the checked-out commit, verifies it, and deploys it.

## Rollback

On the server, point `current` back to a previous release and restart the service:

```bash
DEPLOY_ROOT=/home/deploy/apps/deckterm/prod \
SYSTEMD_SERVICE=deckterm-prod.service \
bash scripts/rollback_release.sh
```
