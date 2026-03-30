# Feature -> Dev -> Main CI/CD

## Goal

Keep two environments available at all times:

- `deckterm_dev` on `4174` for active development
- `deckterm` on `4173` for stable production

## Branch model

- `feature/*`: short-lived work branches
- `dev`: integration branch for validated feature work
- `main`: production branch

## CI model

- Every push to `feature/*`, `fix/*`, `chore/*`, `dev`, or `main` runs unit tests and a stable Playwright smoke subset.
- Dependabot targets `dev`, not `main`, so dependency updates are validated before production promotion.

## Deploy model

- `main` packages a release archive after tests pass.
- Live deploy is gated by repository variable `ENABLE_PROD_DEPLOY=1`.
- Promotion from `dev` to `main` happens through a dedicated PR workflow, not direct pushes to `main`.
- Deploys are atomic:
  - extract to a new release directory
  - install dependencies
  - boot a candidate on a temporary port
  - health-check candidate
  - switch the `current` symlink
  - restart the production service
  - health-check live port
  - rollback automatically if live health fails

## Operational result

- `deckterm_dev` stays free for ongoing work.
- `deckterm` is rebuilt from `main`, not from a mutable working tree.
- Promotion to production becomes a git action backed by CI/CD, not a manual shell sequence.
