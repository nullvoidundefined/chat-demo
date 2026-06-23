import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/wikipedia/searchWikipediaArticles', () => ({
    searchWikipediaArticles: vi.fn(async () => [
        { title: 'Anthropic', snippet: 'AI safety company' },
    ]),
}));

import { searchWikipedia } from '@/tools/searchWikipedia';
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';

describe('searchWikipedia tool', () => {
    afterEach(() => vi.clearAllMocks());

    it('has a name and required query in its schema', () => {
        expect(searchWikipedia.schema.name).toBe('search_wikipedia');
        expect(searchWikipedia.schema.input_schema.required).toContain('query');
    });

    it('calls the client and returns the results as a JSON string', async () => {
        const out = await searchWikipedia.execute({ query: 'Anthropic' }, { tavilyApiKey: 'x' });
        expect(searchWikipediaArticles).toHaveBeenCalledWith('Anthropic', 5);
        expect(JSON.parse(out)[0].title).toBe('Anthropic');
    });

    it('rejects empty query input', async () => {
        await expect(searchWikipedia.execute({ query: '' }, { tavilyApiKey: 'x' })).rejects.toThrow(
            /query/,
        );
    });
});
