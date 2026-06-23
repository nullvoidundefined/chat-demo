import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/runResearchAgent', () => ({
    runResearchAgent: vi.fn(async (_messages, { sink }) => {
        sink.onToolCall('search_wikipedia', { query: 'x' });
        sink.onToolResult('search_wikipedia', '3 result(s)');
        sink.onText('Partial ');
        sink.onDone('Final answer.');
    }),
}));

import { runResearchAgent } from '@/services/agent/runResearchAgent';
import { collectAgentRun } from '@/services/eval/collectAgentRun';

describe('collectAgentRun', () => {
    afterEach(() => vi.clearAllMocks());

    it('collects the final answer and the tools used', async () => {
        const run = await collectAgentRun('What is X?', {
            client: {} as never,
            deps: { tavilyApiKey: 't' },
        });
        expect(run.finalAnswer).toBe('Final answer.');
        expect(run.toolsUsed).toEqual(['search_wikipedia']);
        expect(run.iterationCount).toBeGreaterThanOrEqual(1);
    });

    it('returns empty toolsUsed when the agent answers without calling any tool', async () => {
        vi.mocked(runResearchAgent).mockImplementationOnce(async (_messages, { sink }) => {
            sink.onText('Thinking...');
            sink.onDone('Direct answer.');
        });

        const run = await collectAgentRun('What is Y?', {
            client: {} as never,
            deps: { tavilyApiKey: 't' },
        });
        expect(run.finalAnswer).toBe('Direct answer.');
        expect(run.toolsUsed).toEqual([]);
        expect(run.iterationCount).toBe(1);
    });
});
