# Tool-Use Research Chatbot (MVP) - Design Spec

Date: 2026-06-23
Status: Approved for planning
Author: brainstorming session (Ian + Claude)

## Purpose

An educational MVP of a tool-use, LLM-driven research chatbot, in the spirit of
the chatbots in Doppelscript and Voyager, plus an offline judge-based eval
system. The repo exists to teach modern best practices for building a
tool-using agent with a measurable quality harness. It is not a production
product.

Representative use: "give me a high-level overview of the Rape of Nanking",
"build a dossier on Anthropic". The agent decides which tools to call, gathers
material from Wikipedia and the web, and writes a synthesized answer with the
tool trajectory visible.

## Scope

In scope:

- Single Next.js application (App Router), TypeScript.
- A streaming chat UI that shows the agent's tool-use steps live.
- Four custom tools: three Wikipedia operations plus a Tavily web search.
- An offline eval harness: dataset -> run agent -> LLM judge -> scored report.

Out of scope (listed so the omissions are explicit, not silent):

- No database, no auth, no persistence. Conversation lives in React state; a
  refresh starts a new conversation. Eval output is written to local files.
- No Playwright E2E suite in the MVP (follow-up).
- No deploy pipeline in the MVP.

## Decisions made during brainstorming

1. Eval system is an **offline harness** (not an inline runtime judge).
2. Tools are **Wikipedia + a general web search** (Tavily), all wired as custom
   client-side tools.
3. Chat UX is **streaming with visible tool steps**.
4. Persistence is **ephemeral, no database**.
5. Agent loop is exposed via a **callback-based `AgentSink`**, with a code
   comment marking a future migration to an async generator. Chosen over the
   generator for readability in an educational repo.
6. Default models: **`claude-opus-4-8` for both the agent and the judge**.
   Swappable via one constants module; README documents `claude-sonnet-4-6` as
   a cheaper alternative for frequent eval runs.

## Stack

- Frontend/runtime: Next.js 16, App Router, TypeScript, React.
- UI: SCSS modules + Radix UI headless primitives (per project conventions).
- LLM: Anthropic API via `@anthropic-ai/sdk`. Adaptive thinking
  (`thinking: { type: 'adaptive', display: 'summarized' }`),
  `output_config.effort = 'high'`.
- Web search: Tavily, wrapped as a third-party client (mirrors Doppelscript's
  `clients/tavily.ts`). Anthropic's server-side `web_search` tool is a noted
  alternative but not used, because wiring a custom tool is the teaching point.
- Validation: Zod (judge structured output via `messages.parse` +
  `output_config.format`).
- Tests: Vitest (unit/component). Playwright deferred.
- Lint/format: copied from Doppelscript's web app: flat ESLint config
  (`next/core-web-vitals`, security, jsx-a11y, the "use SCSS modules not inline
  styles" rule) and Prettier (2-space, 80-width, single-quote, import sort).
  Note: this differs from the "4-space / 100-width" line in the shared
  CLAUDE.md; the explicit instruction to copy Doppelscript's config wins.

## Architecture

Three subsystems.

### 1. Agent core (server)

A single tool-use loop, `runResearchAgent(messages, { sink })`, behind one
streaming route handler `POST /api/chat`. The loop is an orchestrator (one
responsibility: sequence model calls and tool calls; no business logic inline).

Pseudocode:

```
runResearchAgent(messages, { sink }):
  for iteration in 1..MAX_AGENT_ITERATIONS:        # default 8
    stream = anthropic.messages.stream({
      model: AGENT_MODEL, system, tools, messages,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: EFFORT },
    })
    for event in stream:
      onThinking delta -> sink.onThinking
      onText delta     -> sink.onText
    final = await stream.finalMessage()
    messages.push({ role: 'assistant', content: final.content })

    if final.stop_reason == 'refusal': sink.onError(refusalMessage); return
    if final.stop_reason != 'tool_use': sink.onDone(textOf(final)); return

    toolResults = []
    for block in toolUseBlocks(final):
      sink.onToolCall(block.name, block.input)
      result = await executeToolCall(block.name, block.input)   # via toolRegistry
      sink.onToolResult(block.name, summarize(result))
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, ...result })
    messages.push({ role: 'user', content: toolResults })

  sink.onError('Hit max agent iterations')          # surfaced, never silently truncated
```

Robustness rules:

- The iteration cap prevents runaway loops and is surfaced via `onError`, not
  swallowed.
- `executeToolCall` wraps each tool in try/catch and returns
  `{ content, is_error: true }` on failure, so the model can recover instead of
  the whole request dying.
- Tool input is always read from the parsed `block.input` object, never by
  string-matching serialized JSON.

### 2. Tools

Each tool module exports one object: an Anthropic tool schema plus an
`execute()` that calls the matching provider client. Tool descriptions are
prescriptive about WHEN to call the tool (Opus 4.8 reaches for tools
conservatively, so trigger conditions in the description give measurable lift).

The four tools and their (deliberately small) return shapes:

- `search_wikipedia(query, limit?)` -> `[{ title, snippet }]`
- `get_wikipedia_article(title)` -> cleaned plain-text extract, truncated to a
  character budget constant, with a flag noting truncation.
- `get_related_articles(title)` -> titles linked from / related to the page.
- `web_search(query)` -> Tavily top results `[{ title, url, snippet }]`.

Returns are kept small on purpose: full article bodies blow up context and cost.

### 3. Eval harness (offline)

Run via `npm run eval`. Flow:

```
1. Load evals/dataset.jsonl -> [{ id, question, rubric, referenceFacts? }]
2. For each item (sequential, small concurrency cap):
     run = runResearchAgent([{role:'user', content: question}], { sink: collectSink })
     collectSink captures { finalAnswer, toolsUsed[], iterationCount }
3. judgeResult(item, run):
     messages.parse({ model: JUDGE_MODEL, system: judgePrompt,
                      output_config: { format: zodOutputFormat(ScoreSchema) } })
     rubric + referenceFacts + answer + tool trajectory go in the user turn
4. writeReport -> evals/reports/report.json (full) + report.md (human summary)
```

`ScoreSchema` (Zod): four 1-10 axes plus rationale and pass flag:

```
{
  factuality:     number 1..10,
  citationUse:    number 1..10,
  completeness:   number 1..10,
  toolEfficiency: number 1..10,
  rationale:      string,
  pass:           boolean,
}
```

`report.md` shows per-axis averages, the pass count (e.g. 12/15), and a table of
per-question scores with one-line rationales.

Reproducibility: the dataset leans on stable, Wikipedia-grounded questions so
live Tavily variance does not dominate scores. `referenceFacts` gives the judge
ground-truth anchors for factuality scoring. The judge is itself an LLM, so
scores are directional, not exact; the README and the report header state this
plainly. Seed dataset ships ~12-15 questions.

## The AgentSink seam

`AgentSink` is a callback interface the loop calls as events occur. It decouples
the loop from where events go, so the same agent serves two consumers without a
reimplementation:

```ts
// services/agent/agentSink.ts
// TODO(future): migrate to an async generator (loop yields events, callers
// `for await` them). Callback form chosen for readability in this teaching repo.
export type AgentSink = {
  onThinking: (delta: string) => void;
  onText: (delta: string) => void;
  onToolCall: (name: string, input: unknown) => void;
  onToolResult: (name: string, summary: string) => void;
  onDone: (finalText: string) => void;
  onError: (message: string) => void;
};
```

- The chat route supplies a sink that writes SSE to the browser.
- The eval harness supplies a sink that collects the final answer and the list
  of tools used.

This is what lets the eval test the real agent, not a copy of it.

## SSE event contract (`/api/chat` -> browser)

Request body: `{ messages: ChatMessage[] }` (full history each turn; the API is
stateless and the conversation lives in React state).

Response: one JSON object per SSE `data:` line, discriminated by `type`:

| type          | payload              | UI effect                                  |
| ------------- | -------------------- | ------------------------------------------ |
| `thinking`    | `{ delta }`          | optional dim "thinking..." line            |
| `text`        | `{ delta }`          | append to the answer bubble                |
| `tool_call`   | `{ name, input }`    | render "Searching Wikipedia for X..." step |
| `tool_result` | `{ name, summary }`  | mark that step done ("3 articles found")   |
| `done`        | `{}`                 | finalize the turn                          |
| `error`       | `{ message }`        | show error state                           |

`state/useChatStream.ts` reads the stream and maintains `messages` plus
per-message `toolSteps[]`.

## Directory layout

```
chat-demo/
  src/
    app/
      layout.tsx
      page.tsx                      # chat page (renders <Chat/>)
      api/chat/route.ts             # POST /api/chat - SSE; runResearchAgent with SSE sink
    components/
      Chat/{Chat.tsx, Chat.module.scss}
      Message/
      ToolStep/                     # renders a single tool-use step
    state/
      useChatStream.ts              # opens SSE, accumulates messages + toolSteps
    api/
      streamChat.ts                 # browser fetch wrapper around /api/chat
    services/
      agent/
        runResearchAgent.ts         # the tool-use loop (orchestrator)
        agentSink.ts                # AgentSink type + future-generator TODO
        toolRegistry.ts             # name -> tool definition + execute
        executeToolCall.ts          # try/catch wrapper, is_error on failure
      sse/
        encodeSseEvent.ts           # event object -> SSE wire string
      eval/
        runEval.ts                  # load dataset, run agent per item (collect sink)
        judgeResult.ts              # messages.parse + Zod ScoreSchema
        writeReport.ts              # report.md + report.json
    tools/
      searchWikipedia.ts
      getWikipediaArticle.ts
      getRelatedArticles.ts
      webSearch.ts
    clients/
      anthropic/createAnthropicClient.ts
      wikipedia/
        searchWikipediaArticles.ts
        getWikipediaPage.ts
        getWikipediaPageLinks.ts
      tavily/searchWeb.ts
    config/                         # env loading, fail-fast on missing keys
    constants/                      # models, MAX_AGENT_ITERATIONS, EFFORT
    prompts/
      researchSystemPrompt.ts
      judgePrompt.ts
    types/                          # ChatMessage, ToolStep, EvalResult, Score
    __tests__/                      # mirrors src layout
    __fixtures__/                   # captured real responses (wikipedia, tavily, judge)
  evals/
    dataset.jsonl                   # {id, question, rubric, referenceFacts?}
    reports/                        # generated; gitignored
  eslint.config.mjs                 # copied from Doppelscript web
  prettier.config.mjs               # copied from Doppelscript
  .env.example                      # ANTHROPIC_API_KEY=, TAVILY_API_KEY=
  package.json
```

Convention notes: `tools/` is agent-facing (schema + execute); `clients/` is the
raw provider call with no agent knowledge. One exported function per file in
`services/`, `api/`, `clients/`, `tools/` (R-235). Tests live in `__tests__/`
mirroring source (R-239), never co-located.

## Config and models

`src/constants/models.ts`:

```
AGENT_MODEL = 'claude-opus-4-8'     // swap to 'claude-sonnet-4-6' to cut eval cost
JUDGE_MODEL = 'claude-opus-4-8'
MAX_AGENT_ITERATIONS = 8
EFFORT = 'high'
```

`config/` loads `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` and fails fast with a
clear message if either is missing. `.env.example` ships both keys.

## Testing strategy

Follows global R-200: tests must fail when behavior is wrong; no self-mocks, no
tautologies, behavior assertions over call-count assertions.

- Tools: unit tests mock the client layer (or `fetch`); assert inputs map to the
  client call and the result is shaped correctly. One negative-input test per
  tool (R-208): empty query, oversized or garbage title.
- Clients: one fixture test per provider against a real captured response
  (Wikipedia JSON, Tavily JSON) committed under `__fixtures__/`. Parsing is
  asserted against the real shape.
- Agent loop: mock the Anthropic client; assert a `tool_use` response drives an
  `executeToolCall` and a follow-up turn; `end_turn` terminates; the iteration
  cap fires `onError`; a throwing tool yields `is_error` rather than a crash.
  Assertions are on sink events, not call counts.
- SSE encoder: round-trip event object -> wire string -> parsed back.
- `useChatStream`: hook/component test feeding a scripted SSE stream; assert
  messages and toolSteps accumulate.
- Judge: fixture test feeding a captured Anthropic judge response; assert
  `ScoreSchema` parse plus report math. No live API in CI.
- Chat page: one component test (render, type, send, see streamed answer with a
  mocked stream).

## Open follow-ups (post-MVP)

- Playwright E2E covering auth-free happy path, error state, keyboard nav,
  reduced motion (per project accessibility conventions).
- Optional: switch `web_search` to Anthropic's server-side tool as a comparison
  exercise.
- Optional: inline runtime judge badge, if the offline harness proves useful.
- Optional: local file persistence of conversations and eval runs.
