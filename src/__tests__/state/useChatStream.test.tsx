import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
    streamChat: vi.fn(async (_messages, onEvent) => {
        onEvent({ type: 'tool_call', name: 'search_wikipedia', input: { query: 'x' } });
        onEvent({ type: 'tool_result', name: 'search_wikipedia', summary: '3 result(s)' });
        onEvent({ type: 'text', delta: 'Hello ' });
        onEvent({ type: 'text', delta: 'world.' });
        onEvent({ type: 'done' });
    }),
}));

import { useChatStream } from '@/state/useChatStream';

describe('useChatStream', () => {
    afterEach(() => vi.clearAllMocks());

    it('accumulates the user message, tool steps, and streamed answer', async () => {
        const { result } = renderHook(() => useChatStream());

        act(() => result.current.send('q'));

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        const [userMessage, assistantMessage] = result.current.messages;
        expect(userMessage).toMatchObject({ role: 'user', content: 'q' });
        expect(assistantMessage.role).toBe('assistant');
        expect(assistantMessage.content).toBe('Hello world.');
        expect(assistantMessage.toolSteps).toEqual([
            { name: 'search_wikipedia', input: { query: 'x' }, summary: '3 result(s)' },
        ]);
    });
});
