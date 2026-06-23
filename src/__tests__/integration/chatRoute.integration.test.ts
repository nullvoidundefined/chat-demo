import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/loadServerConfig', () => ({
    loadServerConfig: () => ({ anthropicApiKey: 'fake-key', tavilyApiKey: 'fake-tavily' }),
}));

vi.mock('@/clients/anthropic/createAnthropicClient');

import * as anthropicClientModule from '@/clients/anthropic/createAnthropicClient';
import { POST } from '@/app/api/chat/route';

type FinalMessage = {
    stop_reason: string;
    content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
};

type StreamEvent = {
    type: string;
    delta?: { type: string; text?: string; thinking?: string };
};

function makeFakeStream(final: FinalMessage, events: StreamEvent[] = []) {
    return {
        async *[Symbol.asyncIterator]() {
            for (const event of events) {
                yield event;
            }
        },
        finalMessage: async () => final,
    };
}

function buildTwoTurnClient() {
    const turns: Array<{ final: FinalMessage; events: StreamEvent[] }> = [
        {
            events: [],
            final: {
                stop_reason: 'tool_use',
                content: [
                    {
                        type: 'tool_use',
                        id: 't1',
                        name: 'search_wikipedia',
                        input: { query: 'Anthropic' },
                    },
                ],
            },
        },
        {
            events: [
                {
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: 'Anthropic is an AI safety company.' },
                },
            ],
            final: {
                stop_reason: 'end_turn',
                content: [{ type: 'text', text: 'Anthropic is an AI safety company.' }],
            },
        },
    ];

    let callIndex = 0;

    return {
        messages: {
            stream: vi.fn(() => {
                const turn = turns[callIndex];
                callIndex += 1;
                return makeFakeStream(turn.final, turn.events);
            }),
        },
    } as never;
}

const WIKIPEDIA_SEARCH_RESPONSE = {
    query: { search: [{ title: 'Anthropic', snippet: 'AI safety' }] },
};

async function readResponseBody(response: Response): Promise<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let body = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        body += decoder.decode(value);
    }
    return body;
}

describe('POST /api/chat (integration)', () => {
    beforeEach(() => {
        vi.mocked(anthropicClientModule.createAnthropicClient).mockReturnValue(
            buildTwoTurnClient(),
        );

        vi.stubGlobal(
            'fetch',
            vi.fn((url: string) => {
                if (url.includes('en.wikipedia.org')) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve(WIKIPEDIA_SEARCH_RESPONSE),
                    });
                }
                return Promise.reject(new Error(`Unexpected fetch to: ${url}`));
            }),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('drives the full route -> agent -> tool -> wikipedia client pipeline', async () => {
        const request = new Request('http://test/api/chat', {
            method: 'POST',
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Tell me about Anthropic' }],
            }),
        });

        const response = await POST(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/event-stream');

        const body = await readResponseBody(response);

        const toolCallIndex = body.indexOf('"type":"tool_call"');
        const toolResultIndex = body.indexOf('"type":"tool_result"');
        const textIndex = body.indexOf('"type":"text"');
        const doneIndex = body.indexOf('"type":"done"');

        expect(toolCallIndex).toBeGreaterThanOrEqual(0);
        expect(toolResultIndex).toBeGreaterThanOrEqual(0);
        expect(textIndex).toBeGreaterThanOrEqual(0);
        expect(doneIndex).toBeGreaterThanOrEqual(0);

        expect(toolCallIndex).toBeLessThan(toolResultIndex);
        expect(toolResultIndex).toBeLessThan(textIndex);
        expect(textIndex).toBeLessThan(doneIndex);

        expect(body).toContain('search_wikipedia');
        expect(body).toContain('Anthropic is an AI safety company.');

        const fetchMock = vi.mocked(fetch);
        const wikipediaCalls = fetchMock.mock.calls.filter(([url]) =>
            String(url).includes('en.wikipedia.org'),
        );
        expect(wikipediaCalls.length).toBeGreaterThan(0);
    });
});
