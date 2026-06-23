import { describe, expect, it } from 'vitest';
import { writeReport } from '@/services/eval/writeReport';
import type { EvalResult } from '@/types/eval';

const results: EvalResult[] = [
    {
        item: { id: 'q1', question: 'Q1', rubric: 'r' },
        run: { finalAnswer: 'a', toolsUsed: ['search_wikipedia'], iterationCount: 1 },
        score: {
            factuality: 8,
            citationUse: 8,
            completeness: 8,
            toolEfficiency: 8,
            rationale: 'good',
            pass: true,
        },
    },
    {
        item: { id: 'q2', question: 'Q2', rubric: 'r' },
        run: { finalAnswer: 'b', toolsUsed: [], iterationCount: 1 },
        score: {
            factuality: 4,
            citationUse: 4,
            completeness: 4,
            toolEfficiency: 6,
            rationale: 'thin',
            pass: false,
        },
    },
];

describe('writeReport', () => {
    it('computes pass count and per-axis averages in the markdown', () => {
        const { markdown } = writeReport(results);
        expect(markdown).toContain('1/2 passed');
        expect(markdown).toContain('factuality');
        expect(markdown).toContain('6.0'); // (8 + 4) / 2
    });

    it('emits valid JSON of the full results', () => {
        const { json } = writeReport(results);
        expect(JSON.parse(json)).toHaveLength(2);
    });
});
