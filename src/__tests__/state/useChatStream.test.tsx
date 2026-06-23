import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
    streamChat: vi.fn(async (_messages, onEvent) => {
        onEvent({ type: 'thinking', delta: 'Step one. ' });
        onEvent({ type: 'thinking', delta: 'Step two.' });
        onEvent({ type: 'tool_call', name: 'search_wikipedia', input: { query: 'x' } });
        onEvent({ type: 'tool_result', name: 'search_wikipedia', summary: '3 result(s)' });
        onEvent({ type: 'text', delta: 'Hello ' });
        onEvent({ type: 'text', delta: 'world.' });
        onEvent({ type: 'done' });
    }),
}));

import { streamChat } from '@/api/streamChat';
import { useChatStream } from '@/state/useChatStream';

describe('useChatStream', () => {
    afterEach(() => vi.clearAllMocks());

    it('accumulates the user message, tool steps, and streamed answer', async () => {
        const { result } = renderHook(() => useChatStream());

        act(() => result.current.send('q'));

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        const [userMessage, assistantMessage] = result.current.messages;
        expect(userMessage).toMatchObject({ role: 'user', content: 'q', thinking: '' });
        expect(assistantMessage.role).toBe('assistant');
        expect(assistantMessage.content).toBe('Hello world.');
        expect(assistantMessage.toolSteps).toMatchObject([
            { name: 'search_wikipedia', input: { query: 'x' }, summary: '3 result(s)' },
        ]);
    });

    it('accumulates thinking deltas onto the assistant message', async () => {
        const { result } = renderHook(() => useChatStream());

        act(() => result.current.send('q'));

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        const assistantMessage = result.current.messages[1];
        expect(assistantMessage.thinking).toBe('Step one. Step two.');
    });

    it('calls streamChat with an AbortSignal as the third argument', async () => {
        const { result } = renderHook(() => useChatStream());

        act(() => result.current.send('q'));

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(vi.mocked(streamChat).mock.calls[0][2]).toBeInstanceOf(AbortSignal);
    });

    it('assigns stable numeric ids to messages and tool steps', async () => {
        const { result } = renderHook(() => useChatStream());

        act(() => result.current.send('q'));

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        const [userMessage, assistantMessage] = result.current.messages;
        expect(typeof userMessage.id).toBe('number');
        expect(typeof assistantMessage.id).toBe('number');
        expect(userMessage.id).not.toBe(assistantMessage.id);
        expect(typeof assistantMessage.toolSteps[0].id).toBe('number');
    });
});
