import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/eval/collectAgentRun');
vi.mock('@/services/eval/judgeResult');

import { collectAgentRun } from '@/services/eval/collectAgentRun';
import { judgeResult } from '@/services/eval/judgeResult';
import { runDataset } from '@/services/eval/runDataset';
import type { EvalItem, EvalRunOutput, Score } from '@/types/eval';

const item1: EvalItem = { id: 'q1', question: 'What is A?', rubric: 'cover A' };
const item2: EvalItem = { id: 'q2', question: 'What is B?', rubric: 'cover B' };

const run1: EvalRunOutput = {
    finalAnswer: 'A is a letter.',
    toolsUsed: ['search_wikipedia'],
    toolCallCount: 1,
};

const score1: Score = {
    factuality: 9,
    citationUse: 8,
    completeness: 7,
    toolEfficiency: 8,
    rationale: 'Good answer.',
    pass: true,
};

describe('runDataset', () => {
    afterEach(() => vi.clearAllMocks());

    it('isolates per-item failures: successful results accumulate and failed items go to failures', async () => {
        vi.mocked(collectAgentRun).mockResolvedValue(run1);
        vi.mocked(judgeResult)
            .mockResolvedValueOnce(score1)
            .mockRejectedValueOnce(new Error('bad judge JSON'));

        const { results, failures } = await runDataset([item1, item2], {
            client: {} as never,
            deps: { tavilyApiKey: 't' },
        });

        expect(results).toHaveLength(1);
        expect(results[0]).toEqual({ item: item1, run: run1, score: score1 });

        expect(failures).toHaveLength(1);
        expect(failures[0].id).toBe('q2');
        expect(failures[0].error).toMatch(/bad judge JSON/);
    });
});
