# Task 10 Report: Eval Harness

## Implementation Notes

### Files Created (11 total)

- `src/services/eval/scoreSchema.ts` - Zod schema for judge structured output (6 axes)
- `src/prompts/judgePrompt.ts` - JUDGE_PROMPT constant with rubric-based scoring instructions
- `src/services/eval/judgeResult.ts` - Calls client.messages.parse with output_config, re-validates via ScoreSchema.parse
- `src/services/eval/collectAgentRun.ts` - Building sink, runs runResearchAgent, collects tools+answer
- `src/services/eval/writeReport.ts` - Pure function; returns { markdown, json }
- `evals/runEval.ts` - Node script via tsx; loads dataset.jsonl, runs agent+judge, writes reports/
- `evals/dataset.jsonl` - 12 seed questions across history, science, tech domains
- `src/__fixtures__/judgeResponse.json` - Captured parse result shape for tests
- `src/__tests__/services/eval/judgeResult.test.ts` - 2 tests
- `src/__tests__/services/eval/collectAgentRun.test.ts` - 1 test
- `src/__tests__/services/eval/writeReport.test.ts` - 2 tests

### TDD Evidence

Each module followed red-green cycle:
1. `judgeResult.test.ts` confirmed FAIL (module not found) before implementation
2. `collectAgentRun.test.ts` confirmed FAIL (module not found) before implementation
3. `writeReport.test.ts` confirmed FAIL (module not found) before implementation
4. All 5 tests green after implementation

### Deviations from Brief

**Brief path `@anthropic-ai/sdk/helpers/zod` does not exist.** The actual path in the installed SDK (0.70.x) is `@anthropic-ai/sdk/helpers/beta/zod` with function `betaZodOutputFormat`. Additionally, `betaZodOutputFormat` requires Zod 4's `z.toJSONSchema` which is absent in the installed Zod 3.25.76. Calling it throws at test time even with a mocked client (args are evaluated before the mock intercepts).

**Resolution:** Built a hand-crafted `SCORE_JSON_SCHEMA` constant matching the ScoreSchema shape and passed it directly in `output_config`. The `as Anthropic.MessageCreateParamsNonStreaming` cast is retained per brief. The client is cast to a narrow `ParseClient` type to expose `messages.parse` (which the test mocks as `client.messages.parse`). The production path would use `client.beta.messages.parse` - this is documented in a comment.

**Casts used:**
- `client as unknown as ParseClient` - to access the mocked `messages.parse` in tests; production would use `client.beta.messages.parse`
- `as Anthropic.MessageCreateParamsNonStreaming` - for output_config which lags SDK types (per brief)

### tsc Result

`npx tsc --noEmit` - 0 errors, clean.

### ESLint Result

`npx eslint evals src/services/eval src/prompts` - 0 errors, 4 warnings.

All 4 warnings are `security/detect-non-literal-fs-filename` on `resolve()`-built paths in `evals/runEval.ts` (mkdirSync, writeFileSync x2, readFileSync). These are expected and unavoidable for dynamically-constructed paths using `import.meta.dirname`; no `eslint-disable` added since the paths are not user-controlled.

### Report Math Verification

`writeReport` averages per-axis across all results. Test: factuality (8+4)/2 = 6.0, confirmed in test assertion. Pass count: filters on `r.score.pass`, 1/2 in test. Both assertions pass.

### No Live API in Tests

- `judgeResult.test.ts`: mocks `client.messages.parse` via `vi.fn(async () => fixture)`
- `collectAgentRun.test.ts`: `vi.mock('@/services/agent/runResearchAgent')` replaces the entire agent
- `writeReport.test.ts`: pure function, no external dependencies

### Concerns

1. **Production path mismatch**: The brief specified `client.messages.parse` but the SDK exposes this as `client.beta.messages.parse`. The cast `ParseClient` makes tests work, but production eval runs need `client.beta.messages.parse`. The runEval.ts script passes the full Anthropic client; at runtime it needs the beta path. This should be fixed in a follow-up by using `client.beta.messages.parse` directly with a proper cast.

2. **Zod v3 vs v4**: The SDK's `betaZodOutputFormat` requires Zod v4. If Zod is upgraded to v4, `betaZodOutputFormat` can replace the hand-built schema and the `ParseClient` cast can be simplified.

---

## Fix: robust judge call

**Problem:** `client.messages.parse` does not exist on `@anthropic-ai/sdk` 0.70.x. Only `client.beta.messages.parse` exists, and even that path requires Zod v4 for schema generation. The previous implementation cast the client to a narrow `ParseClient` type to satisfy the test mock, but would throw at runtime when called from `evals/runEval.ts` with a real `Anthropic` client.

**Change:** Replaced `client.messages.parse(...)` with `client.messages.create(...)` (standard, stable, always present). The model is instructed via three new lines appended to `JUDGE_PROMPT` to return a raw JSON object only (no prose, no markdown fences). The response text block is located by `content.find(block => block.type === 'text')`, then `JSON.parse`d, then validated through `ScoreSchema.parse`. The `SCORE_JSON_SCHEMA` constant and `ParseClient` type were deleted.

**Files changed:**
- `src/prompts/judgePrompt.ts` - appended 3 lines of JSON-output instruction to `JUDGE_PROMPT`
- `src/services/eval/judgeResult.ts` - switched to `client.messages.create`; extracts text block, JSON.parses, ScoreSchema.parse validates
- `src/__fixtures__/judgeResponse.json` - updated from `{ parsed_output: {...} }` shape to flat score object matching what `JSON.parse(text)` produces
- `src/__tests__/services/eval/judgeResult.test.ts` - fake client now uses `messages.create` returning `{ content: [{ type: 'text', text: JSON.stringify(scoreObject) }] }`; both valid and invalid (factuality: 99) test cases preserved

**Verification results:**
- `npx vitest run src/__tests__/services/eval` - 5 tests passed (3 files)
- `npx tsc --noEmit` - 0 errors, clean
- `npx eslint evals src/services/eval src/prompts` - 0 errors, 4 pre-existing warnings (non-literal fs paths in runEval.ts, unchanged)

---

## Fix: judge robustness + axis types

**Changes made:**

1. `src/services/eval/judgeResult.ts` - Added guard: if `response.content.find(b => b.type === 'text')` returns undefined or has no string `.text`, throws `new Error('Judge returned no text content')`. Also strips optional markdown code fences (`\`\`\`json` or `\`\`\``) before `JSON.parse` using two `.replace()` calls on the trimmed text. Avoids `any` by using `'text' in textBlock` narrowing check.

2. `src/services/eval/writeReport.ts` - Introduced `type NumericAxis = 'factuality' | 'citationUse' | 'completeness' | 'toolEfficiency'` and updated `AXES` and `average()` to use it instead of `keyof Score`. Removed now-unused `Score` import. No behavior change.

3. `src/__tests__/services/eval/collectAgentRun.test.ts` - Added second `it(...)` that overrides the module-level mock via `vi.mocked(runResearchAgent).mockImplementationOnce(...)` to call only `sink.onText` then `sink.onDone` with no `onToolCall`. Asserts `finalAnswer === 'Direct answer.'`, `toolsUsed === []`, `iterationCount === 1`.

**Verification results:**
- `npx vitest run src/__tests__/services/eval` - 6 tests passed (3 files: judgeResult x2, collectAgentRun x2, writeReport x2)
- `npx tsc --noEmit` - 0 errors, clean
- `npx eslint src/services/eval` - 0 errors, 0 warnings
