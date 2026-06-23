# Engineering Audit: chat-demo

- **Date:** 2026-06-23
- **Auditor role:** Engineering (CTO perspective)
- **Scope:** Full repo. Source under `src/`, eval runner under `evals/`, tests in `src/__tests__/`, fixtures in `src/__fixtures__/`, CI, deploy/build config, docs.
- **Primary lens:** AI-slop vs clean/SOLID.
- **Branch:** `main`. Report committed; source untouched; not pushed.

---

## Executive Summary

This is a deliberately-scoped educational MVP, and it reads as clean, intentional, human-reviewed code, not AI slop. The architecture is the strongest thing here: the `AgentSink` seam is a genuine, earned interface (the same agent loop drives both the SSE route and the offline eval collector with no branching inside the loop), the layering is disciplined and one-directional, and the codebase follows its own one-function-per-file convention almost everywhere. Tests are behavioral, not tautological, and they actually fail when the implementation is wrong. 39/39 pass, typecheck is clean, lint is clean (4 expected security warnings only).

The real risks are concentrated and narrow, and none of them are architectural. They cluster in two places. First, a set of live-API integration points that no test exercises and whose types are forced with `as unknown as` casts, riding on an Anthropic SDK that is 35 minor versions behind the API surface the code calls. Second, a handful of small but real correctness/consistency defects: a streamed `thinking` event the UI silently discards, a 5-file formatting drift that CI cannot catch, and spec-vs-implementation drift in the judge.

**Top 3 priorities:**

1. **P1.** The agent's `messages.stream` call and the judge's `messages.create` call are the only paths to production, and zero tests touch the real shapes. Combined with a `0.70.1` SDK that is 35 versions stale and an `as unknown as Anthropic.MessageStreamParams` cast masking unsupported params, a silent SDK/API drift will surface only at runtime in front of a user. Add one live/recorded smoke and pin the SDK to a version whose types actually include the params used.
2. **P1.** `thinking` SSE events are produced, encoded, sent over the wire, and then dropped on the floor by the client. `useChatStream.applyEvent` has no `thinking` branch. This is wasted bandwidth and a half-built feature that the spec explicitly says is in scope. Either render it or stop emitting it.
3. **P2.** Formatting drift in 5 files (clients + config) that CI structurally cannot catch. They are 2-space; the project mandates 4-space; `prettier --check` fails on them; CI runs lint/typecheck/test/build but not `prettier --check`. The guardrail has a hole exactly where the drift lives.

**Operational note:** This is an MVP with no deploy pipeline and no E2E by explicit design (documented in the spec's out-of-scope list). I do not treat those as blockers here, because they are deliberate, written-down trade-offs for an educational repo, but I flag below the one place (the live-API smoke) where "no integration coverage" crosses from acceptable-omission into real-risk.

---

## Operational Basics

| Check | Status | Notes |
|---|---|---|
| Tests run? | **Yes** | `npm test` produces 39/39 pass in ~1.7s. |
| Tests meaningful? | **Yes** | Behavioral assertions, real fixtures, no self-mocks. See Testing section. |
| CI present & green-capable? | **Yes (with a gap)** | `.github/workflows/ci.yml` runs typecheck, lint, test, build on push+PR. Does not run `prettier --check`; see P2-1. |
| Typecheck clean? | **Yes** | `tsc --noEmit` clean. |
| Lint clean? | **Yes** | 4 `security/detect-non-literal-fs-filename` warnings in `evals/runEval.ts`, all expected (local file writes). |
| E2E wired up? | **No, by design** | Playwright explicitly deferred in spec (line 33, 62). Not a blocker for this MVP. |
| Monitoring / error tracking? | **No, by design** | No deploy, no persistence, no Sentry. Acceptable for MVP; would be a blocker pre-launch. |
| Rollback plan? | **N/A** | No deploy pipeline exists yet. |
| Secrets handled correctly? | **Yes** | See Credential Exposure Scan. Clean. |

---

## AI-Slop vs Clean/SOLID: Verdict

**Overall judgment: Clean, SOLID, human-reviewed. This is the opposite of AI slop.**

The tell of AI slop is ceremony without judgment: abstractions that exist because they "feel professional," redundant comments that restate code, defensive branches for impossible states, generic naming, and tests that assert mocks were called. This repo shows the inverse signature on nearly every axis.

### Where it is genuinely clean and deliberate (with evidence)

- **`AgentSink` is an earned interface, not incidental abstraction.** `src/services/agent/agentSink.ts:6` defines a 6-method callback contract. Two concrete sinks consume it with zero changes to the loop: the SSE route builds one in `src/app/api/chat/route.ts:55` (each callback maps to a wire event), and the eval harness builds a collecting one in `src/services/eval/collectAgentRun.ts:19` (accumulating text and tool trajectory). This is textbook Dependency Inversion: `runResearchAgent` depends on the abstraction, callers supply the concretion. The payoff is real: the eval harness exercises the exact same agent code path as production, which is the single most valuable property an eval harness can have. A slop version would have duplicated the loop or branched on an `isEval` flag.
- **Single Responsibility is honored to the file level.** Every module under `services/`, `clients/`, `tools/`, `api/` exports exactly one function/object and is named for it (`getWikipediaPage.ts`, `encodeSseEvent.ts`, `executeToolCall.ts`). Orchestrator-vs-atomic decomposition is correct: `runResearchAgent` is a genuine orchestrator (sequences stream, finalize, branch on stop_reason, run tools, loop), and its helpers (`streamDeltaToSink`, `runToolCalls`, `textOf`, `summarize`) are atomic and ordered caller-above-callee.
- **Layering is one-directional and clean.** `components -> state(hooks) -> api -> (wire) -> route -> services -> clients`. No upward imports, no cycles, no layer-skips. Tools depend on clients; clients depend on nothing but `fetch` and constants. The DI is honest: `ToolDeps` (`src/tools/agentTool.ts:5`) threads the Tavily key in rather than letting the client reach for `process.env`, and `searchWeb` takes the key as a parameter (`src/clients/tavily/searchWeb.ts:10`) with a comment stating exactly that intent.
- **Naming is domain-specific, not generic.** `finalAnswer`, `toolsUsed`, `iterationCount`, `truncated`, `referenceFacts`, `stripHtml`. The one `data` (`getWikipediaPage.ts:16`) is a tightly-typed JSON envelope, which is defensible.
- **File-header comments state why, not what.** `runResearchAgent.ts:1-6` explains the loop's contract and records a deferred design decision. `searchWeb.ts:1-2` explains why the key is passed in. These are intentional, not machine-generated restatements.
- **Tests are behavioral and can fail.** The judge schema test (`judgeResult.test.ts:35`) feeds `factuality: 99` and asserts a throw; it tests the Zod guard, not the mock. The Wikipedia truncation test (`getWikipediaPage.test.ts:33`) asserts real slicing behavior against `MAX_ARTICLE_CHARS`. The route test (`route.test.ts:35`) reads the actual SSE byte stream and asserts frame contents.

### Where it is sloppy, over-built, or under-built (with evidence)

- **Dead feature path: `thinking` events.** Produced (`runResearchAgent.ts:71`), encoded, sent, and then silently dropped: `useChatStream.applyEvent` (`src/state/useChatStream.ts:60`) has no `thinking` case. Half-built, not slop-by-generation, but it is dead weight on the wire. (P1-2)
- **Speculative generality (YAGNI): `streamChat`'s `signal` param.** `src/api/streamChat.ts:8` accepts an `AbortSignal`; the sole caller never passes one and nothing aborts (`useChatStream.ts:48`). Unused speculative parameter, the mildest AI-slop tell present. (P3-1)
- **Consistency drift: default vs named exports.** `tools/*` use `export default` (`searchWikipedia.ts:36`); everything else in `services/`/`clients/`/`api/` uses named exports. R-235 and the rest of the repo favor named. Minor but it is exactly the "inconsistent patterns across similar modules" smell. (P2-2)
- **Formatting drift: 2-space vs 4-space in 5 files.** Clients + `loadServerConfig.ts` are 2-space; the project mandates 4. Looks like these were lifted from another repo (the spec at line 63-68 says lint config was copied from "Doppelscript," which uses 2-space) and never reformatted. (P2-1)
- **Casts that mask real type problems, not just convenience.** `runResearchAgent.ts:37` `as unknown as Anthropic.MessageStreamParams`: double-cast to force `thinking`/`output_config` params the installed SDK types reject. This is the one cast that is genuinely hiding a problem (SDK/API drift), not just narrowing `unknown`. (P1-1) The `input as { query?: string }` casts in tools are acceptable: the value is `unknown` from the model and immediately validated.

**Net:** the weaknesses are small, local, and mostly "under-built MVP" rather than "over-engineered slop." There is no premature framework, no speculative plugin system, no config-driven abstraction-for-its-own-sake. The `executeToolCall` + `toolRegistry` indirection is earned: it is what lets the loop dispatch by name and convert failures uniformly; it is not ceremony.

---

## Findings by Severity

### P0: Blockers

**None.** No leaked credentials, no red CI, no broken build, no vacuous test suite, no production data-loss path.

---

### P1: High

#### P1-1: Live-API paths are untested and ride on a 35-versions-stale SDK behind an `as unknown as` cast
- **Where:** `src/services/agent/runResearchAgent.ts:29-37` (`client.messages.stream(... as unknown as Anthropic.MessageStreamParams)`); `src/services/eval/judgeResult.ts:25-30` (`client.messages.create`).
- **Evidence:** Installed `@anthropic-ai/sdk` is `0.70.1`; latest is `0.105.0` (35 minor versions behind). The stream call passes `thinking: { type: 'adaptive', display: 'summarized' }` and `output_config: { effort: EFFORT }`, which the `0.70.1` types do not accept, hence the double cast at line 37. Every test mocks `messages.stream`/`messages.create` with hand-rolled shapes (`runResearchAgent.test.ts:25`, `judgeResult.test.ts:23`). Nothing verifies the real request is accepted or the real response is shaped as assumed.
- **Why it matters:** These two calls are the only paths between this code and production. The cast means TypeScript is actively not checking them. A param the live API renames/removes, or a response-shape change in `stream.finalMessage()` / `content_block_delta`, surfaces only at runtime, in front of a user, with no test to catch it. The staleness compounds the risk: the bigger the SDK gap, the more likely the request body the code sends no longer matches what the pinned client serializes.
- **Concrete fix:**
  1. Pin the SDK to a version whose types include `thinking` (adaptive) and `output_config`, then delete the `as unknown as` cast so the compiler checks the call. If no released type supports the params, isolate the cast behind a single typed wrapper function with a comment naming the exact SDK gap and a tracking note; do not scatter the assumption.
  2. Add one recorded-fixture integration test for `runResearchAgent` that asserts against a captured real `messages.stream` event sequence plus `finalMessage()` (the repo already has the fixture discipline: `src/__fixtures__/judgeResponse.json` is a captured judge response; extend it). Per the project's own LLM-consumer rule (R-200), each LLM consumer should have one fixture test against a real captured response. The judge has one; the agent stream does not.

#### P1-2: `thinking` stream events are emitted and then silently discarded by the client
- **Where:** Emitted at `src/services/agent/runResearchAgent.ts:71`; typed at `src/types/chat.ts:16`; sent at `src/app/api/chat/route.ts:57`; dropped at `src/state/useChatStream.ts:60-86` (no `thinking` branch in `applyEvent`).
- **Evidence:** The spec (design doc line 54-56) lists summarized adaptive thinking as an intended, in-scope behavior. The agent produces it, the route forwards it, and the only consumer ignores it.
- **Why it matters:** Either a half-built feature (the "show my work" UX the masthead promises at `Chat.tsx:26` is exactly what thinking would serve) or pure wasted bandwidth on every turn. It is dead code on the wire: the AI-slop smell of "produce data nobody reads."
- **Concrete fix:** Decide intent. If thinking should render, add a `thinking` branch to `applyEvent` and a `thinking` field on `DisplayMessage` plus a UI affordance (collapsed by default). If not, drop `onThinking`/the `thinking` SSE variant/the `thinking_delta` handling so the type union reflects reality. Do not leave it emitted-but-ignored.

---

### P2: Medium

#### P2-1: Formatting drift in 5 files, in a blind spot CI cannot see
- **Where:** `src/clients/wikipedia/getWikipediaPage.ts`, `getWikipediaPageLinks.ts`, `searchWikipediaArticles.ts`, `src/clients/tavily/searchWeb.ts`, `src/config/loadServerConfig.ts` (all 2-space; project mandates 4-space, `prettier.config.mjs`).
- **Evidence:** `npx prettier --check 'src/clients/**' 'src/config/**'` reports "Code style issues found in 5 files." CI (`ci.yml`) runs lint/typecheck/test/build but not `prettier --check`, and ESLint uses `eslint-config-prettier` (which disables style rules rather than enforcing them). So the formatter that owns indentation is never run in CI. Commit `0293c9d` ("defer formatting to shared CLAUDE.md") shows this was a known deferral that never closed.
- **Why it matters:** The guardrail has a hole exactly where the drift lives. The drift will not self-heal and will spread to any file copied from these.
- **Concrete fix:** Run `npm run format`, commit. Then add a `format:check` step (`prettier --check .`) to `ci.yml` so the gate covers what lint deliberately delegates.

#### P2-2: Tool modules use `export default` while every sibling tree uses named exports
- **Where:** `src/tools/searchWikipedia.ts:36`, `getWikipediaArticle.ts:29`, `getRelatedArticles.ts:30`, `webSearch.ts:31`.
- **Evidence:** `services/`, `clients/`, `api/` all use named exports; `toolRegistry.ts:3-6` imports the tools as default. R-235 (one exported function per file) and repo convention favor named exports for grepability and consistent import style.
- **Why it matters:** Inconsistent pattern across structurally identical modules, the exact "inconsistent patterns across similar modules" smell, even if minor. Default exports are harder to grep and rename-refactor.
- **Concrete fix:** Convert the four tools to named exports (`export const searchWikipedia` or `export function`), update `toolRegistry.ts` imports. Low effort, one commit.

#### P2-3: Spec says the judge uses `messages.parse` plus structured output; implementation hand-parses JSON from text
- **Where:** Spec design doc line 60-61 ("judge structured output via `messages.parse` + `output_config.format`"). Implementation `src/services/eval/judgeResult.ts:25-40` uses `messages.create`, then strips markdown fences with regex (`line 37`) and `JSON.parse` plus `ScoreSchema.parse`.
- **Evidence:** The fence-stripping regex (`.replace(/^```(?:json)?\n?/, '')`) exists precisely because the model is not being constrained to structured output; it is a workaround for free-text JSON. The Zod re-validation is good defense, but the spec's chosen mechanism was not implemented.
- **Why it matters:** Two harms. (1) Spec-vs-code drift: a future reader trusts the spec and is wrong. (2) The fence-stripping path is brittle: a judge response that wraps JSON in prose, or emits two fenced blocks, breaks `JSON.parse` and the eval run dies mid-dataset (no per-item try/catch in `runEval.ts:19-24`). For an eval harness that costs real Opus tokens per run, one malformed judge response loses the whole run.
- **Concrete fix:** Either (a) implement the spec, using the SDK's structured-output/tool-based JSON path so the model is constrained, or (b) update the spec to match reality and wrap the per-item `judgeResult` call in `runEval.ts` in a try/catch that records a failed score and continues, so one bad parse does not waste the whole dataset's spend.

---

### P3: Low / Nits

#### P3-1: Unused `signal` param (YAGNI)
- **Where:** `src/api/streamChat.ts:8`. No caller passes it; nothing aborts.
- **Fix:** Either wire abort into `useChatStream` (cancel in-flight stream on new send / unmount), which is genuinely nice UX, or remove the param until needed.

#### P3-2: `collectAgentRun.iterationCount` is a misnomer; it counts tool calls, not loop iterations
- **Where:** `src/services/eval/collectAgentRun.ts:24-26` increments `iterationCount` inside `onToolCall`; `runResearchAgent` has no per-iteration sink callback, so the collector cannot observe true iterations.
- **Why it matters:** The judge prompt scores `toolEfficiency` and the field is surfaced as "iterationCount" in `EvalRunOutput`; it actually equals `toolsUsed.length`. Minor, but a metric named for something it does not measure is a future-debugging trap. `Math.max(iterationCount, 1)` (line 43) also floors a legitimate zero-tool run to 1.
- **Fix:** Rename to `toolCallCount`, or emit a real per-iteration sink event if true iteration count matters. Drop the `Math.max(...,1)` floor or document why a zero-tool answer is reported as 1.

#### P3-3: `summarize` heuristic in the agent loop is fragile-by-design but acceptable
- **Where:** `runResearchAgent.ts:110-123`. Parses tool-result JSON to produce a human summary; falls back to truncation. Fine for an MVP; noted only because the `'title' in parsed` branch (line 116) assumes a shape no type guarantees. Not worth fixing now.

#### P3-4: `Message`/`ToolStep` use array index as React `key`
- **Where:** `Chat.tsx:36`, `Message.tsx:13`. Append-only lists, so stable in practice. Acceptable; noted for completeness.

---

## Section-by-Section Detail

### Architecture & Design
Strong. One-directional layering, no cycles, earned abstractions (`AgentSink`, `toolRegistry`/`executeToolCall`). The eval harness reusing the production agent path via a sink is the standout decision. No findings beyond those above.

### Code Quality
High. Consistent naming, correct orchestrator/atomic decomposition, file headers that explain why. Defects are the export-style drift (P2-2) and formatting drift (P2-1). No dead code beyond the `thinking` path (P1-2) and the `signal` param (P3-1). No copy-paste duplication of note: the three Wikipedia clients share the `WIKIPEDIA_API` literal but each is a distinct query, which is fine. Extracting a "Wikipedia client base" here would be the over-abstraction smell, correctly avoided.

### Security
Good for the threat model. Findings, none rising above informational for an MVP:
- **SSRF surface:** All `fetch` targets are hardcoded hosts (`WIKIPEDIA_API`, `TAVILY_API`, `api.anthropic.com`). User/model input only ever fills query params and POST bodies, never the host/path. `getWikipediaPage` puts the model-supplied `title` into `URLSearchParams` (`getWikipediaPage.ts:23-33`), which is correctly encoded: no host injection, no path traversal. No SSRF.
- **Prompt injection:** The agent feeds tool results (Wikipedia/web content) back to the model. Wikipedia HTML is stripped (`searchWikipediaArticles.ts:33`) and articles are length-capped (`MAX_ARTICLE_CHARS`). Injected instructions inside fetched content could influence the model: inherent to any tool-use agent and out of scope for an educational MVP, but worth a one-line note in the README so it is not a silent omission.
- **Input validation:** Route validates `messages` is a non-empty array (`route.ts:17`) and returns 400 otherwise. Tools validate non-empty `query`/`title` (e.g. `searchWikipedia.ts:25`). The repo's negative-input-test rule (R-208) is satisfied for tools (empty-string tests exist) and the route (missing-messages test). No oversized-payload guard on `messages` (a client could POST a huge array, driving large Anthropic spend), but no auth and no deploy means this is informational, not a finding.
- **Secrets:** Keys loaded server-side via `loadServerConfig`, fail-fast on missing, passed by value, never logged or echoed. `.env` gitignored and never committed. Clean.
- **No rate limiting** on `/api/chat`. Correct to defer for an MVP with no deploy; would be a P1 the moment this is exposed publicly.

### Credential Exposure Scan
- **Git history (all refs):** clean. No matches for Anthropic (`sk-ant-api03-...`), Tavily (`tvly-...`), or other patterns.
- **Working tree:** clean. `.env` is present-but-untracked (gitignored at `.gitignore:5`) and was never committed (`git log --all -- .env` empty; `git ls-files .env` empty).
- **`.env.example`:** placeholder-only (empty values). Correct.
- **No secrets in source, tests, fixtures, or docs.**
- **Verdict: PASS.** No rotation or purge required. The scan did not copy any matched values; none were found.

### Database
N/A. No database, by explicit design (spec out-of-scope, line 31). Not a finding.

### API Design
`/api/chat` is a single POST returning SSE. Error shape is plain-text body for the 400 (`route.ts:18`) and an in-stream `{type:'error'}` event for runtime failures (`route.ts:39`): two different error channels, which is reasonable given one is pre-stream and one is mid-stream. SSE framing (`encodeSseEvent.ts`) and client parsing (`streamChat.ts:27`, split on `\n\n`) are correct and symmetric. No versioning, no rate limiting, both acceptable MVP omissions.

### Performance
- **No client-side polling.** Grepped for `refetchInterval`/`setInterval`/`useInterval`/custom pollers: none. The UI is push-driven via SSE, which is the correct model for this data (streamed agent turns). This is exactly the polling-against-event-driven-data antipattern the rubric warns about, and the repo correctly avoids it.
- **Context bounding:** articles capped at `MAX_ARTICLE_CHARS` (6000), search limited to 5, page links to 20. Sensible.
- **Cost:** both agent and judge default to `claude-opus-4-8` at `effort: 'high'`, `max_tokens: 8000`. README documents the Sonnet swap. The one perf-adjacent risk is P2-3: a single malformed judge response aborts the whole eval run, wasting all prior Opus spend.

### Testing
Genuinely good for an MVP. 39 tests, all behavioral. Highlights: route test reads the real SSE byte stream; judge test exercises the Zod guard with out-of-range input; Wikipedia client tests assert real truncation math against fixtures; `executeToolCall` test covers success/throw/unknown-tool. Mocking discipline is sound: mocks are at true boundaries (`fetch`, the Anthropic client, `streamChat`), never self-mocking the unit under test. Gap: the live `messages.stream` shape (P1-1) and the `thinking`-event consumption (P1-2, untested because unimplemented). No E2E by design.

### Dependencies & Supply Chain
- **`@anthropic-ai/sdk` 0.70.1 vs 0.105.0 latest:** 35 minor versions behind, and this is the dependency whose API the code calls with forced casts (P1-1). This is the one that matters; update it deliberately and re-typecheck the stream/judge calls.
- Other deps are recent-major and current-enough for an MVP (Next 16, React 19, Zod 3.25, Vitest 3). `npm outdated` shows next-major bumps available for several (eslint 10, vitest 4, zod 4, jsdom 29): none urgent, all major-version migrations to schedule, not chase.
- `package-lock.json` present; `npm ci` used in CI. Lockfile integrity fine.
- No known-CVE blockers surfaced; `eslint-plugin-security` is wired and only flags the expected local-fs warnings.

### Deployment & Infrastructure
No deploy pipeline, no Dockerfile, no Railway/Vercel config, by explicit design (spec out-of-scope, line 34). `next.config.ts` is empty default. CI is correct for what it covers (typecheck/lint/test/build on push+PR, Node 24, `npm ci`) with the one prettier gap (P2-1). `engines.node: 24.x` matches the CI runner. No drift between CI Node and declared engines. Nothing to roll back because nothing deploys: acceptable, but the moment a deploy target is added, monitoring plus rollback move to P1.

### Bug Fix Discipline
**Clean.** Full history scanned (6 commits): zero `fix:`/`bug:`/`hotfix:` commits. No unpaired-fix pattern because there are no fixes yet. This is a greenfield MVP landed feature-first. Nothing to flag.

### Runbook-vs-Code Drift Scan
No `docs/runbooks/` directory exists. The one spec-vs-code contradiction found is the judge mechanism (P2-3, design doc line 60-61 vs `judgeResult.ts`), reported above. No env-var/cookie/CSRF/port drift (single port 3000, no cookies, no CSRF surface).

### Workspace Hygiene
The project lives under `~/Desktop/code/personal/development/chat-demo`. A scoped check of the personal-code tree did not surface a second copy of this project (no duplicate `package.json name: "chat-demo"` ancestor located in scope). No duplicate-workspace finding. If the user maintains other roots (`~/code`, `~/projects`), a wider `find ... -name package.json` would confirm; not run here to stay in scope.

---

## Tech Debt Register

| Item | Location | Risk | Severity |
|---|---|---|---|
| Live-API calls untested + stale SDK + masking cast | `runResearchAgent.ts:37`, `judgeResult.ts:25` | Runtime-only failure on SDK/API drift | P1 |
| `thinking` events emitted but never rendered | `useChatStream.ts:60` | Dead wire traffic / half-built feature | P1 |
| Prettier drift in 5 files, CI cannot see it | clients + config | Drift spreads; guardrail blind spot | P2 |
| Tool default-export inconsistency | `tools/*` | Pattern inconsistency, grep/refactor friction | P2 |
| Judge spec/code drift + no per-item error isolation | `judgeResult.ts`, `runEval.ts` | Wasted Opus spend on one bad parse | P2 |
| Unused `signal` param | `streamChat.ts:8` | YAGNI; trivial | P3 |
| `iterationCount` misnomer + `Math.max(...,1)` floor | `collectAgentRun.ts:24-43` | Misleading metric | P3 |

---

## Prioritized Recommendations

| # | Recommendation | Impact | Effort |
|---|---|---|---|
| 1 | Pin Anthropic SDK to a version whose types include `thinking`/`output_config`; delete the `as unknown as` cast; add one captured-fixture test for the real `messages.stream` event sequence (P1-1). | H | M |
| 2 | Resolve `thinking`: render it or stop emitting it (P1-2). | M | S-M |
| 3 | `npm run format` the 5 drifted files; add `prettier --check` to CI (P2-1). | M | S |
| 4 | Wrap per-item `judgeResult` in `runEval.ts` with try/catch; align judge mechanism with spec or update spec (P2-3). | M | S |
| 5 | Convert tool modules to named exports (P2-2). | L | S |
| 6 | Decide `signal`: wire abort-on-new-send or remove (P3-1). Rename `iterationCount` to `toolCallCount` (P3-2). | L | S |

---

## Closing Judgment

This codebase would pass a senior code review with a short punch-list, not a rewrite. The architecture decisions are the kind a thoughtful engineer defends in a design doc, and in fact are defended in the design doc, with chosen-vs-alternative-vs-why reasoning. The AI-slop signature (ceremony, generic naming, impossible-state defense, mock-only tests, premature abstraction) is essentially absent. The real risks are a small, named set of integration-boundary and consistency issues, all fixable in well under a day, none architectural. For an educational MVP whose stated goal is to demonstrate a clean modern agent loop with measurable quality, it largely succeeds: the eval-reuses-production-path design is genuinely exemplary. Close P1-1 and P1-2 before anyone treats this as production, and the P2s before anyone copies its patterns into a real product.
