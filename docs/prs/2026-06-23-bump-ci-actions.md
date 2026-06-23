# Bump CI actions to v5

Date: 2026-06-23
Branch: `chore/bump-actions`
Time since implementation: same session.

## Summary

Bumps `actions/checkout` and `actions/setup-node` from v4 to v5 in the CI
workflow. The v4 tags still run on Node 20, which GitHub is deprecating on its
runners; v5 runs on Node 24 and removes the deprecation warning.

## What changed

- `.github/workflows/ci.yml`: `actions/checkout@v4` to `@v5`,
  `actions/setup-node@v4` to `@v5`. No other change; inputs are unchanged
  (`node-version: '24'`, `cache: npm`).

## Architectural decisions

- **Pin to the major tag (`@v5`)** (chosen) vs a full commit SHA (alternative).
  Why: matches the existing style in this workflow and is the common convention
  for first-party GitHub actions; SHA-pinning is a supply-chain hardening step
  worth doing repo-wide later, not piecemeal here.

## Testing

The workflow runs on this PR (the `pull_request` trigger), so the bumped actions
are exercised end to end before merge: a green `verify` job confirms checkout and
setup-node v5 work with the existing steps.

## Reflection

Pure maintenance. The only thing to confirm is that the v5 actions still accept
the same inputs, which they do; the deprecation notice is what prompted the bump.
