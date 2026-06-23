### Task 7: `/api/chat` SSE route

**Files:**
- Create: `src/app/api/chat/route.ts`
- Test: `src/__tests__/app/api/chat/route.test.ts`

**Interfaces:**
- Consumes: `runResearchAgent`, `loadServerConfig`, `createAnthropicClient`, `encodeSseEvent`.
- Produces: `POST(request: Request): Promise<Response>` returning `text/event-stream`. Request body: `{ messages: ChatMessage[] }`.

- [ ] **Step 1: Write the failing test**

The test mocks `runResearchAgent` to drive the sink, and asserts the response is an event stream whose body contains the encoded events.

`src/__tests__/app/api/chat/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/loadServerConfig', () => ({
  loadServerConfig: () => ({ anthropicApiKey: 'k', tavilyApiKey: 't' }),
}));
vi.mock('@/clients/anthropic/createAnthropicClient', () => ({
  createAnthropicClient: () => ({}) as never,
}));
vi.mock('@/services/agent/runResearchAgent', () => ({
  runResearchAgent: vi.fn(async (_messages, { sink }) => {
    sink.onToolCall('search_wikipedia', { query: 'x' });
    sink.onToolResult('search_wikipedia', '3 result(s)');
    sink.onText('Answer.');
    sink.onDone('Answer.');
  }),
}));

import { POST } from '@/app/api/chat/route';

async function readBody(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe('POST /api/chat', () => {
  afterEach(() => vi.clearAllMocks());

  it('streams the agent events as SSE frames', async () => {
    const request = new Request('http://test/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'q' }] }),
    });
    const response = await POST(request);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const body = await readBody(response);
    expect(body).toContain('"type":"tool_call"');
    expect(body).toContain('"type":"done"');
  });

  it('returns 400 when messages are missing', async () => {
    const request = new Request('http://test/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/api/chat/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the route**

`src/app/api/chat/route.ts`:

```ts
/** POST /api/chat - runs the research agent and streams its events to the
 * browser as Server-Sent Events. */
import { createAnthropicClient } from '@/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '@/config/loadServerConfig';
import { runResearchAgent } from '@/services/agent/runResearchAgent';
import { encodeSseEvent } from '@/services/sse/encodeSseEvent';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ChatMessage, SseEvent } from '@/types/chat';
import type Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
  } | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }

  const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
  const client = createAnthropicClient(anthropicApiKey);
  const messages = body.messages.map(toMessageParam);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: SseEvent) =>
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      const sink = buildSink(send);
      try {
        await runResearchAgent(messages, {
          client,
          sink,
          deps: { tavilyApiKey },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

function buildSink(send: (event: SseEvent) => void): AgentSink {
  return {
    onThinking: (delta) => send({ type: 'thinking', delta }),
    onText: (delta) => send({ type: 'text', delta }),
    onToolCall: (name, input) => send({ type: 'tool_call', name, input }),
    onToolResult: (name, summary) =>
      send({ type: 'tool_result', name, summary }),
    onDone: () => send({ type: 'done' }),
    onError: (message) => send({ type: 'error', message }),
  };
}

function toMessageParam(message: ChatMessage): Anthropic.MessageParam {
  return { role: message.role, content: message.content };
}
```

- [ ] **Step 4: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/app/api/chat/route.test.ts`
Expected: PASS (2 tests).

```bash
git add src/app/api/chat src/__tests__/app/api/chat
git commit -m "feat: add /api/chat SSE route streaming agent events"
```

---

