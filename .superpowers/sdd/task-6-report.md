# Task 6 Report: AgentSink + SSE Encoder + Tool-Use Research Loop

## Implementation Notes

Created 6 files per the brief:

- `src/services/agent/agentSink.ts` - `AgentSink` callback interface with verbatim TODO(future) comment per spec
- `src/services/sse/encodeSseEvent.ts` - SSE frame serializer: `data: <json>\n\n`
- `src/prompts/researchSystemPrompt.ts` - `RESEARCH_SYSTEM_PROMPT` constant
- `src/services/agent/runResearchAgent.ts` - The tool-use loop orchestrator with private helpers
- `src/__tests__/services/sse/encodeSseEvent.test.ts` - 1 test
- `src/__tests__/services/agent/runResearchAgent.test.ts` - 4 tests

The loop: iterates up to `MAX_AGENT_ITERATIONS` (8), streams delta events to sink, reads `finalMessage()`, routes on `stop_reason` (refusal -> onError, tool_use -> execute tools + continue, anything else -> onDone). Cap exhaustion -> onError with `/max.*iteration/i` message.

The fake Anthropic client in tests uses a scripted async iterable via `[Symbol.asyncIterator]()` returning a single `content_block_delta` event, and `finalMessage()` returning pre-set `FinalMessage` values. `vi.mock` on both `executeToolCall` and `toolRegistry` isolates the loop from real tool execution and schema loading.

## TDD Evidence

**encodeSseEvent:**
- RED: `npx vitest run ...encodeSseEvent.test.ts` -> "No test files found" (file not yet created), then module-not-found after test file created but before implementation
- GREEN: 1 test passed after implementing `encodeSseEvent.ts`

**runResearchAgent:**
- RED: module-not-found error after test file created, before implementation
- GREEN: 4 tests passed after implementing `runResearchAgent.ts`

## tsc --noEmit Result

Clean. Zero errors.

## Casts Used and Why

**`as unknown as Anthropic.MessageStreamParams`** in `runResearchAgent.ts` at the `client.messages.stream(...)` call.

Reason: The SDK's published types define `thinking` only as `ThinkingConfigEnabled | ThinkingConfigDisabled` (no `adaptive` type variant). Likewise, `output_config` with `effort` is not in the published `MessageCreateParamsBase`. These parameters are intentional runtime-level API features documented in the brief. A simple `as Anthropic.MessageStreamParams` fails because TypeScript requires sufficient overlap for a direct cast; going through `unknown` forces the cast without the overlap requirement. The parameters are preserved at runtime; only the type-system check is bypassed.

`streamDeltaToSink` uses `event: unknown` with a local cast to an intersection type that covers the needed fields -- this is a precise structural cast (not a bare `any`) for events emitted by the SDK's stream async iterable, which types its yields as a union containing many event shapes.

`(parsed as { title: string }).title` in `summarize` -- precise cast after the `'title' in parsed` guard confirms shape.

## Files Changed

- Created: `src/services/agent/agentSink.ts`
- Created: `src/services/sse/encodeSseEvent.ts`
- Created: `src/prompts/researchSystemPrompt.ts`
- Created: `src/services/agent/runResearchAgent.ts`
- Created: `src/__tests__/services/sse/encodeSseEvent.test.ts`
- Created: `src/__tests__/services/agent/runResearchAgent.test.ts`

## Concerns

None. The double cast (`as unknown as`) is the documented pattern per the brief and is preferable to `any`. All 4 loop behaviors are asserted: end_turn -> onDone, tool_use -> execute + continue -> onDone, refusal -> onError, cap exhaustion -> onError with regex match.
