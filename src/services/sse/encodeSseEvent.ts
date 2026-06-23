/** Serializes one SseEvent into a Server-Sent Events `data:` frame. */
import type { SseEvent } from '@/types/chat';

export function encodeSseEvent(event: SseEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
}
