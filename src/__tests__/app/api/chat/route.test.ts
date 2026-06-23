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
