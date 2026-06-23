# Task 7 Report: POST /api/chat SSE Route

## Implementation Notes

Created two files per the brief:

- `src/app/api/chat/route.ts` -- Next.js App Router route handler exporting `POST` and `export const runtime = 'nodejs'`.
- `src/__tests__/app/api/chat/route.test.ts` -- Vitest suite with two tests.

The route:
1. Parses and validates the request body (400 if `messages` missing, not an array, or empty).
2. Loads server config and creates the Anthropic client.
3. Maps `ChatMessage[]` to `Anthropic.MessageParam[]` via `toMessageParam`.
4. Constructs a `ReadableStream` whose `start` builds an `AgentSink` (`buildSink`) that encodes each event with `encodeSseEvent` and enqueues it; wraps `runResearchAgent` in try/catch so errors emit an `error` SSE frame; closes the controller in `finally`.
5. Returns the stream as `text/event-stream`.

R-227 check: `POST` is an orchestrator (sequences validation, config, client, mapping, stream creation -- no inline business logic). The clean-code hook flagged its ~36 lines but the orchestrator exception applies; no extraction needed. `buildSink` and `toMessageParam` are atomic helpers, both well under the 25-line ceiling.

## TDD Evidence

- RED: `npx vitest run src/__tests__/app/api/chat/route.test.ts` failed with "Failed to resolve import" before the route existed.
- GREEN: Both tests passed after implementation (2 passed, 0 failed).

## tsc Result

`npx tsc --noEmit` -- no output, exit 0. Clean.

## Files Changed

- `src/app/api/chat/route.ts` (created)
- `src/__tests__/app/api/chat/route.test.ts` (created)

## Concerns

None. The route matches the brief exactly. The mock-driven test validates the SSE framing and 400 path without requiring a real Anthropic client.
