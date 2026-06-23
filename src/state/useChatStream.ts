/** React hook that drives a chat conversation: sends history to /api/chat via
 * streamChat and accumulates streamed text, thinking, and tool steps per assistant turn. */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '@/api/streamChat';
import type { ChatMessage, ChatRole, SseEvent, ToolStep } from '@/types/chat';

export type DisplayMessage = {
    id: number;
    role: ChatRole;
    content: string;
    thinking: string;
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
    const messageIdCounter = useRef(0);
    const toolStepIdCounter = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const send = useCallback(
        (text: string) => {
            if (!text.trim() || isStreaming) {
                return;
            }
            const userMessage: DisplayMessage = {
                id: messageIdCounter.current++,
                role: 'user',
                content: text,
                thinking: '',
                toolSteps: [],
            };
            const history: ChatMessage[] = [...messages, userMessage].map((m) => ({
                role: m.role,
                content: m.content,
            }));

            setMessages((prev) => [
                ...prev,
                userMessage,
                {
                    id: messageIdCounter.current++,
                    role: 'assistant',
                    content: '',
                    thinking: '',
                    toolSteps: [],
                },
            ]);
            setIsStreaming(true);

            const controller = new AbortController();
            abortControllerRef.current = controller;

            async function runStream(): Promise<void> {
                await streamChat(
                    history,
                    (event) => {
                        setMessages((prev) => applyEvent(prev, event, toolStepIdCounter));
                    },
                    controller.signal,
                );
            }
            void runStream()
                .catch((error: unknown) => {
                    if (error instanceof Error && error.name === 'AbortError') {
                        return;
                    }
                    setMessages((prev) => {
                        const next = [...prev];
                        const last = next[next.length - 1];
                        if (last && last.role === 'assistant') {
                            next[next.length - 1] = {
                                ...last,
                                content: last.content + `\n[error: stream aborted unexpectedly]`,
                            };
                        }
                        return next;
                    });
                })
                .finally(() => setIsStreaming(false));
        },
        [isStreaming, messages],
    );

    return { messages, send, isStreaming };
}

function applyEvent(
    messages: DisplayMessage[],
    event: SseEvent,
    toolStepIdCounter: React.MutableRefObject<number>,
): DisplayMessage[] {
    const next = [...messages];
    const last = next[next.length - 1];
    if (!last || last.role !== 'assistant') {
        return next;
    }
    if (event.type === 'thinking') {
        next[next.length - 1] = { ...last, thinking: last.thinking + event.delta };
    } else if (event.type === 'text') {
        next[next.length - 1] = { ...last, content: last.content + event.delta };
    } else if (event.type === 'tool_call') {
        const toolStep: ToolStep = {
            id: toolStepIdCounter.current++,
            name: event.name,
            input: event.input,
            summary: null,
        };
        next[next.length - 1] = {
            ...last,
            toolSteps: [...last.toolSteps, toolStep],
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
