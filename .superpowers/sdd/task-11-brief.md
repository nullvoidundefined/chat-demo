### Task 11: README, env example, full-suite gate

**Files:**
- Create: `README.md`
- Verify: full test suite, lint, build.

- [ ] **Step 1: Write `README.md`**

```markdown
# Research Chatbot (educational MVP)

A streaming, tool-using research chatbot with an offline LLM-judge eval harness.
Built to demonstrate a modern agent loop with measurable quality.

## What it does

Ask for an overview or a dossier ("overview of the Rape of Nanking", "dossier on
Anthropic"). The agent calls Wikipedia and web-search tools, shows each step
live, and writes a cited synthesis.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` and
   `TAVILY_API_KEY`.
3. `npm run dev` and open http://localhost:3000

## Architecture

- `src/services/agent/runResearchAgent.ts` - the tool-use loop. Emits events to
  an `AgentSink`; the chat route supplies an SSE sink, the eval harness a
  collecting sink, so both exercise the same agent.
- `src/tools/` - the four custom tools (schema + execute).
- `src/clients/` - thin provider wrappers (Wikipedia REST, Tavily, Anthropic).
- `src/services/eval/` - the offline judge harness.

## Models

`src/constants/models.ts` sets `AGENT_MODEL` and `JUDGE_MODEL` (both
`claude-opus-4-8`). Switch `AGENT_MODEL` to `claude-sonnet-4-6` to cut eval cost.

## Evals

`npm run eval` runs the agent over `evals/dataset.jsonl`, judges each answer, and
writes `evals/reports/report.md` and `report.json`. Scores come from an LLM judge
and are directional, not exact.

## Tests

`npm test` runs the Vitest suite (unit, client fixtures, agent loop, route, hook,
components, eval). No live API calls in tests.
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (all tests green; ~30 tests).

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors. Fix any lint issues (e.g. import order) before committing.

- [ ] **Step 4: Build smoke**

Run: `npm run build`
Expected: Next build succeeds.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README and project overview"
```

---

## Self-review notes

- Spec coverage: agent loop (Task 6), four tools (Task 5), Wikipedia + Tavily
  clients (Tasks 3-4), SSE contract (Tasks 6-7), streaming UI with visible tool
  steps (Tasks 8-9), offline judge harness with rubric + report (Task 10),
  ephemeral no-DB design (no persistence anywhere), AgentSink with
  future-generator TODO (Task 6), Opus 4.8 both models (Task 1 constants), copied
  Doppelscript configs (Task 1). All present.
- The `as Anthropic...` casts on the two model calls are intentional: the SDK's
  published types may lag `output_config`/`thinking`/`parsed_output`; the runtime
  shapes are correct per the Anthropic API. Do not strip the parameters to satisfy
  the type checker; cast instead.
- Negative-input tests exist per tool (Task 5) per R-208.
- Out of scope, by design: Playwright E2E, persistence, deploy.
