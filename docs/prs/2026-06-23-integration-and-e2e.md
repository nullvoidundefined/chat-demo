# Integration tests + Playwright E2E, wired into CI

Date: 2026-06-23
Branch: `test/integration-and-e2e`
Time since implementation: same session.

## Summary

Fifth PR. Adds the two missing layers of the test pyramid (integration and E2E)
and wires both into CI, on top of the existing unit/component suite. Also closes
the integration-test half of audit P1-1 (the agent stream path was never
exercised end to end).

## What changed

- **Integration (Vitest, `src/__tests__/integration/`):** real internal wiring,
  only the external boundary mocked.
    - `chatRoute.integration.test.ts`: drives the real `POST /api/chat` through the
      real agent loop, tool registry, tools, and Wikipedia client, mocking only the
      Anthropic SDK (a scripted tool-use-then-answer stream) and `fetch`. Asserts the
      SSE stream emits `tool_call -> tool_result -> text -> done` and that the real
      client called `en.wikipedia.org`.
    - `evalPipeline.integration.test.ts`: real `runDataset -> collectAgentRun ->
runResearchAgent -> judgeResult -> writeReport`, SDK mocked, asserting a scored
      result and report contents.
- **E2E (Playwright, `e2e/`):** a real chromium browser against the built prod
  server, intercepting `POST /api/chat` at the browser seam with a scripted SSE
  stream (the agent runs server-side, so the network seam is the clean mock point).
    - `chat.spec.ts`: masthead + empty state, then type -> send -> tool step renders
      -> thinking disclosure -> streamed answer -> empty state gone.
    - `accessibility.spec.ts`: an axe scan asserting zero serious/critical violations
      on initial render.
- **CI:** a second `e2e` job installs chromium and runs Playwright; the existing
  `verify` job runs the integration tests via `npm test`.
- Vitest `include`/`exclude` scoped so `npm test` runs only `src/__tests__` and
  never the Playwright specs; Playwright outputs are git- and prettier-ignored.

## Architectural decisions

- **Mock at the browser network seam for E2E** (chosen) vs a mock Anthropic server.
  Why: the LLM call is server-side, so intercepting `/api/chat` in the browser
  validates the entire client stack (hook + SSE parsing + components + styling)
  against a deterministic stream, with no API keys and no flakiness.
- **Separate Vitest and Playwright runners** (chosen). Why: Vitest's default glob
  matches `*.spec.ts`; scoping its `include` to `src/__tests__/**/*.test.{ts,tsx}`
  keeps the two suites from colliding.
- **Integration tests mock only the true boundary** (SDK + `fetch`) so the route,
  agent loop, tools, and clients are all real code under test.

## Testing

tsc clean; `npm test` 46 pass (43 + 3 integration) and runs no E2E; lint clean;
`prettier --check .` clean; build green; `npm run test:e2e` 3 pass locally
(chromium). CI runs both jobs.

## Reflection

The integration test is the one the audit asked for under P1-1: it exercises the
agent stream shape the unit tests only mocked, so a future SDK/contract drift in
the route-to-tool path now fails a test instead of a user request.
