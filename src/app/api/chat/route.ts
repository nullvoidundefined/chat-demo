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
        onToolResult: (name, summary) => send({ type: 'tool_result', name, summary }),
        onDone: () => send({ type: 'done' }),
        onError: (message) => send({ type: 'error', message }),
    };
}

function toMessageParam(message: ChatMessage): Anthropic.MessageParam {
    return { role: message.role, content: message.content };
}
