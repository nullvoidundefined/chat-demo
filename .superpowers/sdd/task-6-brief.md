### Task 6: AgentSink + SSE encoder + the agent loop

**Files:**
- Create: `src/services/agent/agentSink.ts`, `src/services/sse/encodeSseEvent.ts`, `src/services/agent/runResearchAgent.ts`, `src/prompts/researchSystemPrompt.ts`
- Test: `src/__tests__/services/sse/encodeSseEvent.test.ts`, `src/__tests__/services/agent/runResearchAgent.test.ts`

**Interfaces:**
- Produces:
  - `AgentSink` (callback interface, see code).
  - `encodeSseEvent(event: SseEvent): string` — returns `data: <json>\n\n`.
  - `RESEARCH_SYSTEM_PROMPT: string`.
  - `runResearchAgent(messages: Anthropic.MessageParam[], opts: { client: Anthropic; sink: AgentSink; deps: ToolDeps }): Promise<void>`.

- [ ] **Step 1: Create `agentSink.ts`**

`src/services/agent/agentSink.ts`:

```ts
/** Callback interface the agent loop calls as events occur, decoupling the
 * loop from its consumer (SSE route vs eval collector).
 *
 * TODO(future): migrate to an async generator (the loop yields events and
 * callers `for await` them). Callback form chosen for readability here. */
export type AgentSink = {
  onThinking: (delta: string) => void;
  onText: (delta: string) => void;
  onToolCall: (name: string, input: unknown) => void;
  onToolResult: (name: string, summary: string) => void;
  onDone: (finalText: string) => void;
  onError: (message: string) => void;
};
```

- [ ] **Step 2: Write failing test for `encodeSseEvent`**

`src/__tests__/services/sse/encodeSseEvent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeSseEvent } from '@/services/sse/encodeSseEvent';
import type { SseEvent } from '@/types/chat';

describe('encodeSseEvent', () => {
  it('round-trips an event through the SSE wire format', () => {
    const event: SseEvent = { type: 'text', delta: 'hello' };
    const wire = encodeSseEvent(event);
    expect(wire.startsWith('data: ')).toBe(true);
    expect(wire.endsWith('\n\n')).toBe(true);
    const parsed = JSON.parse(wire.slice('data: '.length).trim());
    expect(parsed).toEqual(event);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement**

Run: `npx vitest run src/__tests__/services/sse/encodeSseEvent.test.ts`
Expected: FAIL (module not found).

`src/services/sse/encodeSseEvent.ts`:

```ts
/** Serializes one SseEvent into a Server-Sent Events `data:` frame. */
import type { SseEvent } from '@/types/chat';

export function encodeSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/sse/encodeSseEvent.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Create the system prompt**

`src/prompts/researchSystemPrompt.ts`:

```ts
/** System prompt for the research agent. Instructs grounded, cited answers
 * and judicious tool use. */
export const RESEARCH_SYSTEM_PROMPT = [
  'You are a research assistant. Answer the user by gathering information',
  'with your tools, then writing a clear, well-organized synthesis.',
  '',
  'Guidelines:',
  '- Prefer search_wikipedia and get_wikipedia_article for encyclopedic',
  '  topics (people, companies, history, science).',
  '- Use web_search for current events or topics Wikipedia covers poorly.',
  '- Use get_related_articles to find adjacent topics worth including.',
  '- Cite the article titles or URLs you drew facts from.',
  '- If sources conflict or are thin, say so rather than guessing.',
  '- Stop calling tools once you have enough to answer well.',
].join('\n');
```

- [ ] **Step 6: Write the failing test for `runResearchAgent`**

This test uses a fake Anthropic client whose `messages.stream` returns a scripted async iterable plus `finalMessage()`. It verifies the loop drives tool calls, terminates on `end_turn`, surfaces the iteration cap, and reports tool errors via the sink.

`src/__tests__/services/agent/runResearchAgent.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/executeToolCall', () => ({
  executeToolCall: vi.fn(async () => ({ content: '[]', isError: false })),
}));
vi.mock('@/services/agent/toolRegistry', () => ({ toolSchemas: [] }));

import { runResearchAgent } from '@/services/agent/runResearchAgent';
import { executeToolCall } from '@/services/agent/executeToolCall';

type FinalMessage = {
  stop_reason: string;
  content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
};

function fakeStream(final: FinalMessage) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
    },
    finalMessage: async () => final,
  };
}

function fakeClient(finals: FinalMessage[]) {
  let call = 0;
  return {
    messages: { stream: vi.fn(() => fakeStream(finals[call++])) },
  } as never;
}

function makeSink() {
  return {
    onThinking: vi.fn(),
    onText: vi.fn(),
    onToolCall: vi.fn(),
    onToolResult: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

const deps = { tavilyApiKey: 'x' };

describe('runResearchAgent', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls onDone with the final text when the model ends its turn', async () => {
    const client = fakeClient([
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Answer.' }] },
    ]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onDone).toHaveBeenCalledWith('Answer.');
    expect(sink.onToolCall).not.toHaveBeenCalled();
  });

  it('executes a tool call then continues to the final answer', async () => {
    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 't1', name: 'search_wikipedia', input: { query: 'x' } },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] },
    ]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(executeToolCall).toHaveBeenCalledWith(
      'search_wikipedia',
      { query: 'x' },
      deps,
    );
    expect(sink.onToolCall).toHaveBeenCalledWith('search_wikipedia', { query: 'x' });
    expect(sink.onToolResult).toHaveBeenCalled();
    expect(sink.onDone).toHaveBeenCalledWith('Done.');
  });

  it('calls onError when a refusal is returned', async () => {
    const client = fakeClient([{ stop_reason: 'refusal', content: [] }]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onError).toHaveBeenCalled();
    expect(sink.onDone).not.toHaveBeenCalled();
  });

  it('calls onError when the iteration cap is exceeded', async () => {
    const toolFinal: FinalMessage = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't', name: 'web_search', input: { query: 'x' } }],
    };
    const client = fakeClient(Array.from({ length: 10 }, () => toolFinal));
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onError).toHaveBeenCalledWith(
      expect.stringMatching(/max.*iteration/i),
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/__tests__/services/agent/runResearchAgent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 8: Implement `runResearchAgent`**

`src/services/agent/runResearchAgent.ts`:

```ts
/** The tool-use loop. Streams model output to the sink, executes any tool
 * calls, and repeats until the model ends its turn, refuses, or the
 * iteration cap is hit. Decoupled from its consumer via AgentSink.
 *
 * TODO(future): yield events from an async generator instead of pushing to a
 * sink (see agentSink.ts). */
import { EFFORT, MAX_TOKENS, AGENT_MODEL } from '@/constants/models';
import { MAX_AGENT_ITERATIONS } from '@/constants/agent';
import { RESEARCH_SYSTEM_PROMPT } from '@/prompts/researchSystemPrompt';
import { executeToolCall } from '@/services/agent/executeToolCall';
import { toolSchemas } from '@/services/agent/toolRegistry';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type Anthropic from '@anthropic-ai/sdk';

type RunOptions = {
  client: Anthropic;
  sink: AgentSink;
  deps: ToolDeps;
};

export async function runResearchAgent(
  messages: Anthropic.MessageParam[],
  { client, sink, deps }: RunOptions,
): Promise<void> {
  const working = [...messages];

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const stream = client.messages.stream({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: toolSchemas,
      messages: working,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: EFFORT },
    } as Anthropic.MessageStreamParams);

    for await (const event of stream) {
      streamDeltaToSink(event, sink);
    }
    const final = await stream.finalMessage();
    working.push({ role: 'assistant', content: final.content });

    if (final.stop_reason === 'refusal') {
      sink.onError('The model declined to answer this request.');
      return;
    }
    if (final.stop_reason !== 'tool_use') {
      sink.onDone(textOf(final.content));
      return;
    }

    const toolResults = await runToolCalls(final.content, sink, deps);
    working.push({ role: 'user', content: toolResults });
  }

  sink.onError('Reached the maximum number of agent iterations.');
}

function streamDeltaToSink(event: unknown, sink: AgentSink): void {
  const typed = event as {
    type?: string;
    delta?: { type?: string; text?: string; thinking?: string };
  };
  if (typed.type !== 'content_block_delta' || !typed.delta) {
    return;
  }
  if (typed.delta.type === 'text_delta' && typed.delta.text) {
    sink.onText(typed.delta.text);
  } else if (typed.delta.type === 'thinking_delta' && typed.delta.thinking) {
    sink.onThinking(typed.delta.thinking);
  }
}

async function runToolCalls(
  content: Anthropic.ContentBlock[],
  sink: AgentSink,
  deps: ToolDeps,
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const block of content) {
    if (block.type !== 'tool_use') {
      continue;
    }
    sink.onToolCall(block.name, block.input);
    const { content: resultContent, isError } = await executeToolCall(
      block.name,
      block.input,
      deps,
    );
    sink.onToolResult(block.name, summarize(resultContent));
    results.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: resultContent,
      is_error: isError,
    });
  }
  return results;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function summarize(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return `${parsed.length} result(s)`;
    }
    if (parsed && typeof parsed === 'object' && 'title' in parsed) {
      return `read "${(parsed as { title: string }).title}"`;
    }
  } catch {
    // not JSON; fall through
  }
  return content.length > 80 ? `${content.slice(0, 80)}...` : content;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/agent/runResearchAgent.test.ts`
Expected: PASS (4 tests). If the SDK's `MessageStreamParams` type rejects `output_config`/`thinking`, the `as Anthropic.MessageStreamParams` cast keeps the runtime call correct; do not remove the parameters.

- [ ] **Step 10: Commit**

```bash
git add src/services/agent/agentSink.ts src/services/agent/runResearchAgent.ts src/services/sse src/prompts/researchSystemPrompt.ts src/__tests__/services
git commit -m "feat: add agent sink, SSE encoder, and the tool-use research loop"
```

---

