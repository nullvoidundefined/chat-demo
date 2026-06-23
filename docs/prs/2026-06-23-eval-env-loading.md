# Load .env in the eval entrypoint

Date: 2026-06-23
Branch: `fix/eval-env-loading`
Time since implementation: same session.

## Summary

`npm run eval` failed with "Missing required environment variable:
ANTHROPIC_API_KEY" even with a populated `.env`, because the standalone script
never loaded it. This wires `.env` into the eval entrypoint.

## What changed

- `package.json` `eval` script: `tsx evals/runEval.ts` becomes
  `node --env-file-if-exists=.env --import tsx evals/runEval.ts`.

## Architectural decisions

- **Node's native `--env-file-if-exists`** (chosen) vs adding `dotenv`. Why: no
  new dependency, and Node 24 (the declared engine) supports it natively. The
  `-if-exists` variant does not crash when `.env` is absent (CI, fresh clone); it
  falls through to `loadServerConfig`'s clear fail-fast error.
- **`node --import tsx`** (chosen) vs `tsx --env-file`. Why: the `tsx` CLI does
  not forward Node's `--env-file` flag, so running Node directly with `tsx` as an
  import hook is the reliable way to combine env loading with TypeScript execution.
- The Next.js dev server already auto-loads `.env`; only this standalone script
  needed it, so nothing else changes.

## Testing

Verified by running `npm run eval` with a throwaway `.env` of dummy keys: the run
no longer fails on missing config, reaches the agent, and each item fails fast on
the invalid key (a 401), which the per-item isolation records as a failure and
continues past. That exercises both the env-loading fix and the per-item error
isolation together. tsc/lint/prettier unaffected (a one-line script change).

## Reflection

This is the gap behind the "the live path isn't exercised end to end" note from
the SDK-upgrade PR: the eval is the cheapest real-key smoke, and it could not even
read the keys. With this, `npm run eval` is the one-command way to validate the
live agent + judge against real credentials.
