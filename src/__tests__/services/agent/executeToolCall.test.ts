import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/toolRegistry', () => ({
    toolRegistry: {
        ok_tool: { execute: vi.fn(async () => '{"ok":true}') },
        boom_tool: {
            execute: vi.fn(async () => {
                throw new Error('kaboom');
            }),
        },
    },
}));

import { executeToolCall } from '@/services/agent/executeToolCall';

describe('executeToolCall', () => {
    afterEach(() => vi.clearAllMocks());

    it('returns content with isError false on success', async () => {
        const out = await executeToolCall('ok_tool', {}, { tavilyApiKey: 'x' });
        expect(out).toEqual({ content: '{"ok":true}', isError: false });
    });

    it('returns isError true with the message when the tool throws', async () => {
        const out = await executeToolCall('boom_tool', {}, { tavilyApiKey: 'x' });
        expect(out.isError).toBe(true);
        expect(out.content).toMatch(/kaboom/);
    });

    it('returns isError true for an unknown tool name', async () => {
        const out = await executeToolCall('nope', {}, { tavilyApiKey: 'x' });
        expect(out.isError).toBe(true);
        expect(out.content).toMatch(/unknown tool/i);
    });
});
