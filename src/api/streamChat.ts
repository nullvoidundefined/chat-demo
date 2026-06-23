/** Browser fetch wrapper around POST /api/chat. Parses the SSE byte stream
 * and invokes onEvent for each decoded SseEvent. */
import type { ChatMessage, SseEvent } from '@/types/chat';

export async function streamChat(
    messages: ChatMessage[],
    onEvent: (event: SseEvent) => void,
    signal?: AbortSignal,
): Promise<void> {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal,
    });
    if (!response.ok || !response.body) {
        throw new Error(`Chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith('data:')) continue;
            onEvent(JSON.parse(line.slice('data:'.length).trim()) as SseEvent);
        }
    }
}
