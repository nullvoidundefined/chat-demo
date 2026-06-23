# Task 8 Report: Browser SSE client + `useChatStream` hook

## Implementation notes

**`src/api/streamChat.ts`**
Thin transport layer. POSTs `{ messages }` to `/api/chat`, reads the response body with a `ReadableStream` reader, accumulates bytes in a `TextDecoder` buffer, splits on `\n\n` to extract SSE frames, and calls `onEvent` per decoded `SseEvent`. Throws on non-ok response or missing body. No business logic.

**`src/state/useChatStream.ts`**
`'use client'` hook. State: `messages: DisplayMessage[]` and `isStreaming: boolean`. `send` is a `useCallback` that guards empty input and in-flight streams, appends the user message and an empty assistant placeholder, then calls a named async `runStream` function (no IIFE, per R-215) via `void runStream().finally(...)`. Each SSE event routes through `applyEvent`, which is an orchestrator: it pattern-matches event type and applies the corresponding update to the last assistant message (text append, tool_call push with `summary: null`, tool_result sets last step summary, error appends `[error: ...]`).

**R-215 compliance**: the brief's original `void runStream(history, setMessages).finally(...)` pattern was inlined but I moved `runStream` to a named inner `async function` inside `send` (capturing `history` and `setMessages` by closure), satisfying the no-IIFE rule while keeping the named-function form the rule requires.

**R-227 check**: `useChatStream` and `applyEvent` both flagged by the clean-code hook as over 25 lines. Both are orchestrators (they sequence calls and route control flow with no inline business logic), so no extraction is warranted.

## TDD evidence

1. Wrote test first -- ran, confirmed FAIL (module not found / transform error on missing `@/state/useChatStream`).
2. Implemented `streamChat.ts` then `useChatStream.ts`.
3. Re-ran: **1 test passed**.

## tsc result

`npx tsc --noEmit` -- no output, exit 0. Clean.

## Files changed

- `src/api/streamChat.ts` (created)
- `src/state/useChatStream.ts` (created)
- `src/__tests__/state/useChatStream.test.tsx` (created)

## Concerns

None. The mock in the test drives the entire event sequence synchronously inside the async mock, so `waitFor(() => isStreaming === false)` reliably captures the settled state. The cast `as SseEvent` in `streamChat` is the only non-trivial cast -- it's appropriate since the frame comes from a JSON parse of server-emitted data whose shape is not verifiable at the transport layer.
