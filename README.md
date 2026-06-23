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
