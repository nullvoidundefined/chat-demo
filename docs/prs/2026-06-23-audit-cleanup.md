# Engineering-audit cleanup (consistency)

Date: 2026-06-23
Branch: `chore/audit-cleanup`
Time since implementation: same session.

## Summary

First of several PRs addressing the 2026-06-23 engineering audit. This one covers
the mechanical consistency findings, no user-facing behavior change.

## What changed

- **P2-2:** the four agent tools now use named exports instead of `export default`,
  matching every other module in `services/`/`clients/`/`api/`. `toolRegistry.ts`
  and the tool tests import them by name.
- **P3-2:** `EvalRunOutput.iterationCount` renamed to `toolCallCount` (it counts
  tool calls, not loop iterations), and the `Math.max(.., 1)` floor removed so a
  zero-tool answer reports `0`. Tests and fixtures updated.
- **P3-3:** the agent loop's `summarize` helper now confirms `parsed.title` is a
  string before using it.
- **P2-1:** the whole repo is reformatted to the 4-space/100 Prettier config (much
  of it was 2-space drift CI could not see), a `.prettierignore` is added, and a
  `format:check` step is added to the CI workflow so the formatter is now gated.

## Architectural decisions

- **Reformat the whole tree, not just the 5 drifted files** (chosen) vs only the
  files the audit named. Why: the drift was actually ~20 files, not 5, and a
  one-time repo-wide format plus a CI gate is the durable fix; a partial format
  leaves the gate failing.
- **`format:check` as its own CI step** (chosen) vs folding formatting into ESLint.
  Why: ESLint uses `eslint-config-prettier`, which deliberately disables style
  rules; Prettier owns formatting, so the gate must run Prettier directly.

## Testing

`tsc --noEmit` clean, `npm test` 39/39, `npm run lint` clean, `prettier --check .`
clean. No behavior changed, so no new tests; renames and the floor removal are
covered by the updated eval tests.

## Reflection

The audit undercounted the formatting drift (5 files) because it checked only the
clients and config; a repo-wide `prettier --check` showed ~20. Verifying the
finding against the code before acting is what surfaced the wider scope.
