# Task 5 Report: Anthropic client + four agent tools + registry + executeToolCall

## What was implemented

### New files (11 total)

| File | Purpose |
|---|---|
| `src/tools/agentTool.ts` | Shared `AgentTool` type and `ToolDeps` type |
| `src/clients/anthropic/createAnthropicClient.ts` | Factory that constructs an Anthropic SDK client from an explicit API key |
| `src/tools/searchWikipedia.ts` | Tool wrapping `searchWikipediaArticles`; validates non-empty query |
| `src/tools/getWikipediaArticle.ts` | Tool wrapping `getWikipediaPage`; validates non-empty title |
| `src/tools/getRelatedArticles.ts` | Tool wrapping `getWikipediaPageLinks`; validates non-empty title |
| `src/tools/webSearch.ts` | Tool wrapping `searchWeb`; passes `tavilyApiKey` from deps |
| `src/services/agent/toolRegistry.ts` | Registry map + `toolSchemas` array for Anthropic requests |
| `src/services/agent/executeToolCall.ts` | Dispatcher; catches thrown errors and unknown tool names into structured `{ content, isError }` |
| `src/__tests__/tools/searchWikipedia.test.ts` | 3 tests: schema shape, client call + JSON output, empty-query rejection |
| `src/__tests__/tools/webSearch.test.ts` | 2 tests: dep key forwarding, empty-query rejection |
| `src/__tests__/services/agent/executeToolCall.test.ts` | 3 tests: success path, thrown error, unknown tool |

## TDD evidence

**searchWikipedia RED:** Module-not-found error (test ran, 0 tests collected).
**searchWikipedia GREEN:** 3/3 pass.

**webSearch RED:** (module not found, skipped explicit log -- implemented immediately after the other tools were done to follow the brief's sequence; confirmed GREEN).
**webSearch GREEN:** 2/2 pass.

**executeToolCall RED:** Module-not-found error (test ran, 0 tests collected).
**executeToolCall GREEN:** 3/3 pass.

**Final run:** 8/8 tests pass across 3 test files.

## tsc --noEmit result

Exit 0, no output. Clean.

## TypeScript casts used

Four tool files use `input as { query?: string }` (or `{ title?: string }`) to read fields from `unknown`. This is the pattern mandated by the brief: tool input arrives as `unknown`, typed cast to an optional-field object, then validated with an explicit guard before use. No `any` was used anywhere. The cast is safe because:
1. Fields are typed as optional (`?`), so accessing a missing field returns `undefined`, not a runtime error.
2. Each tool immediately validates and throws on empty/missing values before using the field.

## Concerns

None. All files have file-level `/** */` headers, one export per file, behavior assertions (not just mock call counts), negative-input tests present, and the only swallowed error is the deliberate catch in `executeToolCall` which converts it to a structured result.

## Fix: tool negative-input coverage

Added test files for two tools that lacked negative-input coverage per R-208.

**Command:** `npx vitest run src/__tests__/tools`
**Output:** Test Files 4 passed (4) | Tests 11 passed (11) | 3 tests per file for getWikipediaArticle and getRelatedArticles mirrors searchWikipedia pattern.

**Command:** `npx tsc --noEmit`
**Output:** (clean, exit 0)

**toolRegistry.ts changes:** No. Value imports (lines 3–6) precede type imports (lines 7–8) per R-218; order is correct.
