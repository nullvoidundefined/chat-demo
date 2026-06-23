import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/wikipedia/getWikipediaPage', () => ({
    getWikipediaPage: vi.fn(async () => ({
        title: 'Anthropic',
        extract: 'text',
        truncated: false,
    })),
}));

import getWikipediaArticle from '@/tools/getWikipediaArticle';
import { getWikipediaPage } from '@/clients/wikipedia/getWikipediaPage';

describe('getWikipediaArticle tool', () => {
    afterEach(() => vi.clearAllMocks());

    it('has a name and required title in its schema', () => {
        expect(getWikipediaArticle.schema.name).toBe('get_wikipedia_article');
        expect(getWikipediaArticle.schema.input_schema.required).toContain('title');
    });

    it('calls the client and returns the results as a JSON string', async () => {
        const out = await getWikipediaArticle.execute(
            { title: 'Anthropic' },
            { tavilyApiKey: 'x' },
        );
        expect(getWikipediaPage).toHaveBeenCalledWith('Anthropic');
        expect(JSON.parse(out).title).toBe('Anthropic');
    });

    it('rejects empty title input', async () => {
        await expect(
            getWikipediaArticle.execute({ title: '' }, { tavilyApiKey: 'x' }),
        ).rejects.toThrow(/title/);
    });
});
