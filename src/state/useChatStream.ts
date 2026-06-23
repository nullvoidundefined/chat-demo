/** React hook that drives a chat conversation: sends history to /api/chat via
 * streamChat and accumulates streamed text and tool steps per assistant turn. */
'use client';

import { useCallback, useState } from 'react';
import { streamChat } from '@/api/streamChat';
import type { ChatMessage, ChatRole, SseEvent, ToolStep } from '@/types/chat';

export type DisplayMessage = {
    role: ChatRole;
    content: string;
    toolSteps: ToolStep[];
};

type UseChatStream = {
    messages: DisplayMessage[];
    send: (text: string) => void;
    isStreaming: boolean;
};

export function useChatStream(): UseChatStream {
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);

    const send = useCallback(
        (text: string) => {
            if (!text.trim() || isStreaming) {
                return;
            }
            const userMessage: DisplayMessage = {
                role: 'user',
                content: text,
                toolSteps: [],
            };
            const history: ChatMessage[] = [...messages, userMessage].map((m) => ({
                role: m.role,
                content: m.content,
            }));

            setMessages((prev) => [
                ...prev,
                userMessage,
                { role: 'assistant', content: '', toolSteps: [] },
            ]);
            setIsStreaming(true);

            async function runStream(): Promise<void> {
                await streamChat(history, (event) => {
                    setMessages((prev) => applyEvent(prev, event));
                });
            }
            void runStream().finally(() => setIsStreaming(false));
        },
        [isStreaming, messages],
    );

    return { messages, send, isStreaming };
}

function applyEvent(messages: DisplayMessage[], event: SseEvent): DisplayMessage[] {
    const next = [...messages];
    const last = next[next.length - 1];
    if (!last || last.role !== 'assistant') {
        return next;
    }
    if (event.type === 'text') {
        next[next.length - 1] = { ...last, content: last.content + event.delta };
    } else if (event.type === 'tool_call') {
        next[next.length - 1] = {
            ...last,
            toolSteps: [...last.toolSteps, { name: event.name, input: event.input, summary: null }],
        };
    } else if (event.type === 'tool_result') {
        next[next.length - 1] = {
            ...last,
            toolSteps: last.toolSteps.map((step, index) =>
                index === last.toolSteps.length - 1 ? { ...step, summary: event.summary } : step,
            ),
        };
    } else if (event.type === 'error') {
        next[next.length - 1] = {
            ...last,
            content: last.content + `\n[error: ${event.message}]`,
        };
    }
    return next;
}
