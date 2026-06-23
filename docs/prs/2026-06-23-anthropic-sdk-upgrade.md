# Upgrade Anthropic SDK, drop the masking cast

Date: 2026-06-23
Branch: `chore/anthropic-sdk-upgrade`
Time since implementation: same session.

## Summary

Fourth engineering-audit PR. Closes the type-safety half of P1-1: upgrades
`@anthropic-ai/sdk` from `0.70.1` to `0.105.0` and removes the
`as unknown as Anthropic.MessageStreamParams` cast that was hiding the agent's
streaming call from the type checker.

## What changed

- `@anthropic-ai/sdk` `^0.70.0` to `^0.105.0` (package.json + lockfile).
- `runResearchAgent.ts`: the `messages.stream({...})` call now passes
  `thinking: { type: 'adaptive', display: 'summarized' }` and
  `output_config: { effort: EFFORT }` directly. The new SDK ships
  `ThinkingConfigAdaptive` and `OutputConfig` as first-class types, so the
  double cast is gone and the compiler now checks the only path to production.

## Architectural decisions

- **Upgrade to latest and delete the cast** (chosen) vs isolating the cast behind
  a wrapper. Why: the released `0.105.0` types accept both params, so the honest
  fix is to let the compiler check the call rather than keep a localized cast.
  No SDK breaking changes affected the code (`messages.stream`, `finalMessage()`,
  and the `MessageParam`/`ContentBlock`/`Tool` types were stable across the jump).

## Testing

`tsc --noEmit` clean (the meaningful signal: the params typecheck with no cast),
43 tests pass, lint clean, `prettier --check .` clean, build green.

**Honesty note:** the tests mock the SDK, so a green suite proves the code
typechecks and the mocked paths pass, not that the live `0.105.0` API call
succeeds at runtime. The integration test that exercises a realistic stream shape
lands in the next PR (test pyramid), which closes the other half of P1-1.

## Reflection

The cast was the one place in the audit where a `as unknown as` genuinely masked
a real problem (SDK/API drift), not just narrowed `unknown`. Removing it restores
the type checker on the request body the agent actually sends.
