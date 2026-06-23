import { describe, expect, it } from 'vitest';
import { encodeSseEvent } from '@/services/sse/encodeSseEvent';
import type { SseEvent } from '@/types/chat';

describe('encodeSseEvent', () => {
    it('round-trips an event through the SSE wire format', () => {
        const event: SseEvent = { type: 'text', delta: 'hello' };
        const wire = encodeSseEvent(event);
        expect(wire.startsWith('data: ')).toBe(true);
        expect(wire.endsWith('\n\n')).toBe(true);
        const parsed = JSON.parse(wire.slice('data: '.length).trim());
        expect(parsed).toEqual(event);
    });
});
