# Add CI workflow

Date: 2026-06-23
Branch: `chore/ci-workflow`
Time since implementation: same session.

## Summary

Adds a GitHub Actions workflow so every pull request and every push to `main`
runs the project gate (typecheck, lint, test, build). The repo had no CI; PRs
merged without an automated check.

## What changed

- `.github/workflows/ci.yml`: one `verify` job on `ubuntu-latest`, Node 24 with
  npm cache, running `npm ci` then `tsc --noEmit`, `npm run lint`, `npm test`,
  `npm run build`. Triggers on `pull_request` (any branch) and `push` to `main`.

## Architectural decisions

- **One combined job** (chosen) vs a matrix or parallel jobs (alternative). Why:
  the suite is small and fast; a single sequential job is simplest and gives a
  clear single status check. Split later if build time grows.
- **No secrets / env** (chosen). Why: the build reads `ANTHROPIC_API_KEY` and
  `TAVILY_API_KEY` only at request time inside the route handler, and every test
  mocks the providers, so CI needs no API keys. Keeping secrets out of CI is the
  safer default.
- **Node 24** to match `engines.node` in `package.json`.
- **`npm ci`** (chosen) vs `npm install` (alternative). Why: `ci` installs exactly
  from the lockfile and fails on drift, which is what a gate should do.

## Testing

Validated locally by reproducing the CI steps from a clean install:
`npm ci` then `tsc --noEmit`, `npm run lint`, `npm test` (39/39), `npm run build`,
all green. The workflow runs on its own PR (the `pull_request` trigger fires from
the PR branch), so it self-validates before merge.

## Reflection

The earlier ESLint config repair added several plugin dependencies; this change is
the reason to confirm they landed in both `package.json` and `package-lock.json`,
since `npm ci` in a clean runner would fail otherwise. Verified before pushing.
