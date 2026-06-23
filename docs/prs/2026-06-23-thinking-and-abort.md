# Render thinking stream, cancel in-flight, stable keys

Date: 2026-06-23
Branch: `feat/thinking-and-abort`
Time since implementation: same session.

## Summary

Second engineering-audit PR. Closes the two client-side P1/P3 findings about the
chat client plus a key-stability nit.

## What changed

- **P1-2:** the `thinking` SSE events the agent already produces and the route
  already forwards are now rendered. `DisplayMessage` gains a `thinking` field,
  `applyEvent` accumulates `thinking` deltas, and `Message` shows them in a
  collapsed, keyboard-operable `<details>` disclosure above the tool steps. The
  "show my work" UX the masthead promises is now real instead of dead wire traffic.
- **P3-1:** `useChatStream` holds an `AbortController` per request, passes its
  signal to `streamChat`, and aborts on a new send and on unmount; `AbortError`
  is swallowed so teardown does not surface as a UI error.
- **P3-4:** `DisplayMessage` and `ToolStep` carry a stable monotonic `id` (from a
  ref counter, not `Math.random`/`Date.now`), used as the React `key` instead of
  the array index.
- Also excludes `tsconfig.json` from Prettier, since Next.js rewrites it (in its
  own 2-space format) on every build; Next owns that file.

## Architectural decisions

- **Native `<details>` for thinking** (chosen) vs a custom toggle component.
  Why: accessible and keyboard-operable for free, collapsed by default, zero JS.
- **Abort on unmount via a ref + effect cleanup** (chosen) vs leaving the stream
  to finish. Why: the `signal` param already existed and was unused (the audit's
  YAGNI flag); wiring real teardown is the honest fix. The `isStreaming` guard
  already prevents concurrent sends, so unmount is the main case.
- **Exclude `tsconfig.json` from Prettier** (chosen) vs committing Next's format.
  Why: Next regenerates it each build; fighting it in the formatter is churn.

## Testing

TDD for the behavioral changes: the hook test now feeds `thinking` events and
asserts accumulation, and asserts `streamChat` receives an `AbortSignal`. 42
tests pass (39 + 3). tsc clean, lint clean, `prettier --check .` clean, build green.

## Reflection

The thinking events were a textbook "produce data nobody reads" smell; rendering
them was both the cheaper and the more honest fix versus deleting the producer,
because the UX was already promised in the masthead copy.
