import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { judgeResult } from '@/services/eval/judgeResult';
import type { EvalItem, EvalRunOutput } from '@/types/eval';

const scoreObject = JSON.parse(
    readFileSync(
        resolve(__dirname, '../../../__fixtures__/judgeResponse.json'),
        'utf8',
    ),
) as Record<string, unknown>;

const item: EvalItem = { id: 'q1', question: 'Q', rubric: 'cover X and Y' };
const run: EvalRunOutput = {
    finalAnswer: 'A',
    toolsUsed: ['search_wikipedia'],
    iterationCount: 2,
};

describe('judgeResult', () => {
    it('returns the parsed score from the judge model', async () => {
        const client = {
            messages: {
                create: vi.fn(async () => ({
                    content: [{ type: 'text', text: JSON.stringify(scoreObject) }],
                })),
            },
        } as never;
        const score = await judgeResult(item, run, client);
        expect(score.factuality).toBe(8);
        expect(score.pass).toBe(true);
    });

    it('validates the score against the schema (rejects out-of-range)', async () => {
        const badScore = { ...scoreObject, factuality: 99 };
        const client = {
            messages: {
                create: vi.fn(async () => ({
                    content: [{ type: 'text', text: JSON.stringify(badScore) }],
                })),
            },
        } as never;
        await expect(judgeResult(item, run, client)).rejects.toThrow();
    });
});
