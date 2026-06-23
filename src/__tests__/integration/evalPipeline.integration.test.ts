import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDataset } from '@/services/eval/runDataset';
import { writeReport } from '@/services/eval/writeReport';
import type { EvalItem } from '@/types/eval';

const JUDGE_SCORE = {
    factuality: 8,
    citationUse: 7,
    completeness: 8,
    toolEfficiency: 8,
    rationale: 'ok',
    pass: true,
};

type FinalMessage = {
    stop_reason: string;
    content: { type: string; text?: string }[];
};

function makeFakeStream(final: FinalMessage) {
    return {
        async *[Symbol.asyncIterator]() {
            yield {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: 'thinking...' },
            };
        },
        finalMessage: async () => final,
    };
}

function buildFakeClient() {
    const agentFinal: FinalMessage = {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Anthropic is an AI safety company.' }],
    };

    return {
        messages: {
            stream: vi.fn(() => makeFakeStream(agentFinal)),
            create: vi.fn(async () => ({
                content: [{ type: 'text', text: JSON.stringify(JUDGE_SCORE) }],
            })),
        },
    } as never;
}

const EVAL_ITEM: EvalItem = {
    id: 'test-q1',
    question: 'What is Anthropic?',
    rubric: 'Mention AI safety and founding.',
    referenceFacts: ['Anthropic is an AI safety company.'],
};

describe('eval pipeline (integration)', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            query: { search: [{ title: 'Anthropic', snippet: 'AI safety' }] },
                        }),
                }),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    });

    it('runs the full pipeline: runDataset -> collectAgentRun -> runResearchAgent -> judgeResult', async () => {
        const client = buildFakeClient();

        const { results, failures } = await runDataset([EVAL_ITEM], {
            client,
            deps: { tavilyApiKey: 'fake-tavily' },
        });

        expect(failures).toHaveLength(0);
        expect(results).toHaveLength(1);

        const [result] = results;
        expect(result.score.factuality).toBe(8);
        expect(result.score.pass).toBe(true);
        expect(result.item.id).toBe('test-q1');
    });

    it('writeReport produces markdown with pass count and axis averages', async () => {
        const client = buildFakeClient();

        const { results } = await runDataset([EVAL_ITEM], {
            client,
            deps: { tavilyApiKey: 'fake-tavily' },
        });

        const { markdown } = writeReport(results);

        expect(markdown).toContain('1/1 passed');
        expect(markdown).toContain('factuality:');
        expect(markdown).toContain('citationUse:');
        expect(markdown).toContain('completeness:');
        expect(markdown).toContain('toolEfficiency:');
    });
});
