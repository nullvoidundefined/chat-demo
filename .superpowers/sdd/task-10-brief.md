### Task 10: Eval harness (judge, runner, report)

**Files:**
- Create: `src/services/eval/scoreSchema.ts`, `src/prompts/judgePrompt.ts`, `src/services/eval/judgeResult.ts`, `src/services/eval/collectAgentRun.ts`, `src/services/eval/writeReport.ts`, `evals/runEval.ts`, `evals/dataset.jsonl`
- Create fixture: `src/__fixtures__/judgeResponse.json`
- Test: `src/__tests__/services/eval/judgeResult.test.ts`, `src/__tests__/services/eval/writeReport.test.ts`, `src/__tests__/services/eval/collectAgentRun.test.ts`

**Interfaces:**
- Produces:
  - `ScoreSchema` (Zod) and `Score` (matches `types/eval.ts`).
  - `JUDGE_PROMPT: string`.
  - `collectAgentRun(question, { client, deps }): Promise<EvalRunOutput>` — runs the agent with a collecting sink.
  - `judgeResult(item, run, client): Promise<Score>`.
  - `writeReport(results: EvalResult[]): { markdown: string; json: string }`.

- [ ] **Step 1: Create the Zod schema and judge prompt**

`src/services/eval/scoreSchema.ts`:

```ts
/** Zod schema for the LLM judge's structured score output. */
import { z } from 'zod';

export const ScoreSchema = z.object({
  factuality: z.number().min(1).max(10),
  citationUse: z.number().min(1).max(10),
  completeness: z.number().min(1).max(10),
  toolEfficiency: z.number().min(1).max(10),
  rationale: z.string(),
  pass: z.boolean(),
});
```

`src/prompts/judgePrompt.ts`:

```ts
/** System prompt for the eval judge. Asks for per-axis 1-10 scores grounded
 * in the rubric and reference facts. */
export const JUDGE_PROMPT = [
  'You are a strict evaluator of research assistant answers.',
  'Score the answer on four axes from 1 (poor) to 10 (excellent):',
  '- factuality: are claims correct and consistent with the reference facts?',
  '- citationUse: are sources (article titles, URLs) cited for key claims?',
  '- completeness: does it cover what the rubric asks?',
  '- toolEfficiency: did the tool trajectory look purposeful, not wasteful?',
  'Set pass=true only if factuality and completeness are both >= 7.',
  'Give a one or two sentence rationale. Be specific and critical.',
].join('\n');
```

- [ ] **Step 2: Write failing test for `judgeResult` using a captured judge fixture**

Create `src/__fixtures__/judgeResponse.json` (real-shaped `messages.parse` result; author this if no key):

```json
{
  "parsed_output": {
    "factuality": 8,
    "citationUse": 7,
    "completeness": 9,
    "toolEfficiency": 8,
    "rationale": "Accurate and well cited; minor gaps on dates.",
    "pass": true
  }
}
```

`src/__tests__/services/eval/judgeResult.test.ts`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { judgeResult } from '@/services/eval/judgeResult';
import type { EvalItem, EvalRunOutput } from '@/types/eval';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/judgeResponse.json'),
    'utf8',
  ),
);

const item: EvalItem = { id: 'q1', question: 'Q', rubric: 'cover X and Y' };
const run: EvalRunOutput = {
  finalAnswer: 'A',
  toolsUsed: ['search_wikipedia'],
  iterationCount: 2,
};

describe('judgeResult', () => {
  it('returns the parsed score from the judge model', async () => {
    const client = {
      messages: { parse: vi.fn(async () => fixture) },
    } as never;
    const score = await judgeResult(item, run, client);
    expect(score.factuality).toBe(8);
    expect(score.pass).toBe(true);
  });

  it('validates the score against the schema (rejects out-of-range)', async () => {
    const bad = { parsed_output: { ...fixture.parsed_output, factuality: 99 } };
    const client = {
      messages: { parse: vi.fn(async () => bad) },
    } as never;
    await expect(judgeResult(item, run, client)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement `judgeResult`**

Run: `npx vitest run src/__tests__/services/eval/judgeResult.test.ts`
Expected: FAIL (module not found).

`src/services/eval/judgeResult.ts`:

```ts
/** Scores one agent run against its rubric using the judge model with a
 * structured (Zod) output format, then re-validates the result. */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { JUDGE_MODEL, MAX_TOKENS } from '@/constants/models';
import { JUDGE_PROMPT } from '@/prompts/judgePrompt';
import { ScoreSchema } from '@/services/eval/scoreSchema';
import type { EvalItem, EvalRunOutput, Score } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

export async function judgeResult(
  item: EvalItem,
  run: EvalRunOutput,
  client: Anthropic,
): Promise<Score> {
  const userContent = [
    `Question: ${item.question}`,
    `Rubric: ${item.rubric}`,
    item.referenceFacts
      ? `Reference facts:\n- ${item.referenceFacts.join('\n- ')}`
      : 'Reference facts: none provided',
    `Tools used: ${run.toolsUsed.join(', ') || 'none'}`,
    `Answer:\n${run.finalAnswer}`,
  ].join('\n\n');

  const response = await client.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: MAX_TOKENS,
    system: JUDGE_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    output_config: { format: zodOutputFormat(ScoreSchema) },
  } as Anthropic.MessageCreateParamsNonStreaming);

  return ScoreSchema.parse(
    (response as { parsed_output: unknown }).parsed_output,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/judgeResult.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing test for `collectAgentRun`**

`src/__tests__/services/eval/collectAgentRun.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/runResearchAgent', () => ({
  runResearchAgent: vi.fn(async (_messages, { sink }) => {
    sink.onToolCall('search_wikipedia', { query: 'x' });
    sink.onToolResult('search_wikipedia', '3 result(s)');
    sink.onText('Partial ');
    sink.onDone('Final answer.');
  }),
}));

import { collectAgentRun } from '@/services/eval/collectAgentRun';

describe('collectAgentRun', () => {
  afterEach(() => vi.clearAllMocks());

  it('collects the final answer and the tools used', async () => {
    const run = await collectAgentRun('What is X?', {
      client: {} as never,
      deps: { tavilyApiKey: 't' },
    });
    expect(run.finalAnswer).toBe('Final answer.');
    expect(run.toolsUsed).toEqual(['search_wikipedia']);
    expect(run.iterationCount).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then implement `collectAgentRun`**

Run: `npx vitest run src/__tests__/services/eval/collectAgentRun.test.ts`
Expected: FAIL (module not found).

`src/services/eval/collectAgentRun.ts`:

```ts
/** Runs the research agent for one question with a collecting sink, returning
 * the final answer and the tool trajectory for the judge. */
import { runResearchAgent } from '@/services/agent/runResearchAgent';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type { EvalRunOutput } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

type CollectOptions = { client: Anthropic; deps: ToolDeps };

export async function collectAgentRun(
  question: string,
  { client, deps }: CollectOptions,
): Promise<EvalRunOutput> {
  const toolsUsed: string[] = [];
  let finalAnswer = '';
  let iterationCount = 0;

  const sink: AgentSink = {
    onThinking: () => {},
    onText: (delta) => {
      finalAnswer += delta;
    },
    onToolCall: (name) => {
      toolsUsed.push(name);
      iterationCount += 1;
    },
    onToolResult: () => {},
    onDone: (text) => {
      finalAnswer = text;
    },
    onError: (message) => {
      finalAnswer = finalAnswer || `[error: ${message}]`;
    },
  };

  await runResearchAgent([{ role: 'user', content: question }], {
    client,
    sink,
    deps,
  });

  return { finalAnswer, toolsUsed, iterationCount: Math.max(iterationCount, 1) };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/collectAgentRun.test.ts`
Expected: PASS (1 test).

- [ ] **Step 8: Write failing test for `writeReport`**

`src/__tests__/services/eval/writeReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { writeReport } from '@/services/eval/writeReport';
import type { EvalResult } from '@/types/eval';

const results: EvalResult[] = [
  {
    item: { id: 'q1', question: 'Q1', rubric: 'r' },
    run: { finalAnswer: 'a', toolsUsed: ['search_wikipedia'], iterationCount: 1 },
    score: {
      factuality: 8,
      citationUse: 8,
      completeness: 8,
      toolEfficiency: 8,
      rationale: 'good',
      pass: true,
    },
  },
  {
    item: { id: 'q2', question: 'Q2', rubric: 'r' },
    run: { finalAnswer: 'b', toolsUsed: [], iterationCount: 1 },
    score: {
      factuality: 4,
      citationUse: 4,
      completeness: 4,
      toolEfficiency: 6,
      rationale: 'thin',
      pass: false,
    },
  },
];

describe('writeReport', () => {
  it('computes pass count and per-axis averages in the markdown', () => {
    const { markdown } = writeReport(results);
    expect(markdown).toContain('1/2 passed');
    expect(markdown).toContain('factuality');
    expect(markdown).toContain('6.0'); // (8 + 4) / 2
  });

  it('emits valid JSON of the full results', () => {
    const { json } = writeReport(results);
    expect(JSON.parse(json)).toHaveLength(2);
  });
});
```

- [ ] **Step 9: Run test to verify it fails, then implement `writeReport`**

Run: `npx vitest run src/__tests__/services/eval/writeReport.test.ts`
Expected: FAIL (module not found).

`src/services/eval/writeReport.ts`:

```ts
/** Builds the human-readable markdown report and the full JSON dump from a
 * set of eval results. Returns strings; the runner writes them to disk. */
import type { EvalResult, Score } from '@/types/eval';

const AXES: (keyof Score)[] = [
  'factuality',
  'citationUse',
  'completeness',
  'toolEfficiency',
];

export function writeReport(results: EvalResult[]): {
  markdown: string;
  json: string;
} {
  const passCount = results.filter((r) => r.score.pass).length;
  const averages = AXES.map(
    (axis) => `${axis}: ${average(results, axis).toFixed(1)}`,
  );

  const rows = results.map(
    (r) =>
      `| ${r.item.id} | ${r.score.factuality} | ${r.score.citationUse} | ` +
      `${r.score.completeness} | ${r.score.toolEfficiency} | ` +
      `${r.score.pass ? 'PASS' : 'FAIL'} | ${r.score.rationale} |`,
  );

  const markdown = [
    '# Eval Report',
    '',
    '> Scores are produced by an LLM judge and are directional, not exact.',
    '',
    `**${passCount}/${results.length} passed**`,
    '',
    `Averages: ${averages.join(', ')}`,
    '',
    '| id | fact | cite | compl | toolEff | result | rationale |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');

  return { markdown, json: JSON.stringify(results, null, 2) };
}

function average(results: EvalResult[], axis: keyof Score): number {
  if (results.length === 0) {
    return 0;
  }
  const total = results.reduce((sum, r) => sum + Number(r.score[axis]), 0);
  return total / results.length;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/writeReport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 11: Create the seed dataset and the runner script**

`evals/dataset.jsonl` (one JSON object per line; ship ~12-15, three shown here):

```
{"id":"nanking","question":"Give me a high-level overview of the Rape of Nanking.","rubric":"Covers what happened, when (1937-1938), where (Nanjing), who (Imperial Japanese Army), and scale; cites Wikipedia.","referenceFacts":["Occurred in Nanjing in 1937-1938","Perpetrated by the Imperial Japanese Army during the Second Sino-Japanese War"]}
{"id":"anthropic","question":"Build a short dossier on the company Anthropic.","rubric":"Covers founding year, founders, what the company does, and a notable product; cites sources.","referenceFacts":["Founded in 2021","Develops the Claude family of AI models"]}
{"id":"photosynthesis","question":"Explain photosynthesis at a high level.","rubric":"Covers inputs (light, water, CO2), outputs (glucose, oxygen), and where it happens (chloroplasts).","referenceFacts":["Converts light energy into chemical energy","Produces oxygen as a byproduct"]}
```

`evals/runEval.ts`:

```ts
/** Offline eval entry point: loads the dataset, runs the agent per question,
 * judges each result, and writes report.md and report.json. */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createAnthropicClient } from '../src/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '../src/config/loadServerConfig';
import { collectAgentRun } from '../src/services/eval/collectAgentRun';
import { judgeResult } from '../src/services/eval/judgeResult';
import { writeReport } from '../src/services/eval/writeReport';
import type { EvalItem, EvalResult } from '../src/types/eval';

async function main(): Promise<void> {
  const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
  const client = createAnthropicClient(anthropicApiKey);
  const deps = { tavilyApiKey };
  const items = loadDataset();

  const results: EvalResult[] = [];
  for (const item of items) {
    process.stdout.write(`Running ${item.id}...\n`);
    const run = await collectAgentRun(item.question, { client, deps });
    const score = await judgeResult(item, run, client);
    results.push({ item, run, score });
  }

  const { markdown, json } = writeReport(results);
  const outDir = resolve(import.meta.dirname, 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'report.md'), markdown);
  writeFileSync(resolve(outDir, 'report.json'), json);
  process.stdout.write(`Wrote ${results.length} results to ${outDir}\n`);
}

function loadDataset(): EvalItem[] {
  const path = resolve(import.meta.dirname, 'dataset.jsonl');
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EvalItem);
}

void main();
```

- [ ] **Step 12: Run the full eval test suite and commit**

Run: `npx vitest run src/__tests__/services/eval`
Expected: PASS (5 tests across 3 files).

```bash
git add src/services/eval src/prompts/judgePrompt.ts evals src/__fixtures__/judgeResponse.json src/__tests__/services/eval
git commit -m "feat: add eval harness (judge, collector, report, runner, dataset)"
```

---

