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
