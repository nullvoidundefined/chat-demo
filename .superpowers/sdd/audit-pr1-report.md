# Audit Cleanup PR1 Report

## Fix A (P2-2): Named exports for agent tools

Changed four tool files from `const X: AgentTool = {...}; export default X;` to `export const X: AgentTool = {...};`:
- `src/tools/searchWikipedia.ts`
- `src/tools/getWikipediaArticle.ts`
- `src/tools/getRelatedArticles.ts`
- `src/tools/webSearch.ts`

Updated consumers to named imports:
- `src/services/agent/toolRegistry.ts`: four default imports changed to named imports
- `src/__tests__/tools/searchWikipedia.test.ts`
- `src/__tests__/tools/getWikipediaArticle.test.ts`
- `src/__tests__/tools/getRelatedArticles.test.ts`
- `src/__tests__/tools/webSearch.test.ts`

## Fix B (P3-2): Rename iterationCount to toolCallCount, drop the floor

- `src/types/eval.ts`: `EvalRunOutput.iterationCount` renamed to `toolCallCount`
- `src/services/eval/collectAgentRun.ts`: local variable renamed, `Math.max(iterationCount, 1)` floor removed, returns true `toolCallCount` (0 for no-tool answers)
- `src/__tests__/services/eval/collectAgentRun.test.ts`: assertions updated; tool-call case asserts `toolCallCount === 1`; no-tool case now asserts `toolCallCount === 0` (not 1)
- `src/__tests__/services/eval/judgeResult.test.ts`: fixture object updated from `iterationCount` to `toolCallCount`
- `src/__tests__/services/eval/writeReport.test.ts`: two fixture objects updated
- `src/services/eval/judgeResult.ts` and `writeReport.ts`: confirmed no reference to `iterationCount` (judgeResult uses `toolsUsed`, writeReport does not reference the count field at all)
- `evals/runEval.ts`: confirmed no reference to `iterationCount`

## Fix C (P3-3): Harden summarize helper

- `src/services/agent/runResearchAgent.ts`: in the private `summarize` function, the `'title' in parsed` check now also verifies `typeof (parsed as { title: unknown }).title === 'string'` before casting and using the title. Prevents a non-string title (number, object, null) from being coerced into the return string. No change to function signature or exported API.

## Fix D (P2-1): Format gate

- `.prettierignore` created: `package-lock.json`, `.next/`, `evals/reports/`, `node_modules/`
- `package.json`: `format` script changed to `prettier --write .`; `format:check` script added: `prettier --check .`
- `.github/workflows/ci.yml`: `Format check` step added between Lint and Test
- `npx prettier --write .` run over the whole repo; 26 files reformatted (primarily 2-space files in clients, config, eval services, and tests); 52 already matched and were unchanged

**Surprise:** `judgeResult.test.ts` and `writeReport.test.ts` also used `iterationCount` in their fixture data (not caught by the initial scope description). tsc caught them immediately; updated both before committing.

## Verification results

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Clean (0 errors) |
| `npm test` | 39/39 passed, 18 test files |
| `npm run lint` | 0 errors, 4 expected security warnings in evals/runEval.ts |
| `npx prettier --check .` | All matched files use Prettier code style! |

## Files touched

`src/tools/searchWikipedia.ts`, `src/tools/getWikipediaArticle.ts`, `src/tools/getRelatedArticles.ts`, `src/tools/webSearch.ts`, `src/services/agent/toolRegistry.ts`, `src/__tests__/tools/searchWikipedia.test.ts`, `src/__tests__/tools/getWikipediaArticle.test.ts`, `src/__tests__/tools/getRelatedArticles.test.ts`, `src/__tests__/tools/webSearch.test.ts`, `src/types/eval.ts`, `src/services/eval/collectAgentRun.ts`, `src/__tests__/services/eval/collectAgentRun.test.ts`, `src/__tests__/services/eval/judgeResult.test.ts`, `src/__tests__/services/eval/writeReport.test.ts`, `src/services/agent/runResearchAgent.ts`, `.prettierignore`, `package.json`, `.github/workflows/ci.yml`, plus 26 source files reformatted by prettier.
