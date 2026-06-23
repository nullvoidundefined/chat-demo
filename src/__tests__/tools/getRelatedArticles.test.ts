import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/wikipedia/getWikipediaPageLinks', () => ({
    getWikipediaPageLinks: vi.fn(async () => ['Claude', 'AI safety']),
}));

import getRelatedArticles from '@/tools/getRelatedArticles';
import { getWikipediaPageLinks } from '@/clients/wikipedia/getWikipediaPageLinks';

describe('getRelatedArticles tool', () => {
    afterEach(() => vi.clearAllMocks());

    it('has a name and required title in its schema', () => {
        expect(getRelatedArticles.schema.name).toBe('get_related_articles');
        expect(getRelatedArticles.schema.input_schema.required).toContain('title');
    });

    it('calls the client and returns the results as a JSON string', async () => {
        const out = await getRelatedArticles.execute(
            { title: 'Anthropic' },
            { tavilyApiKey: 'x' },
        );
        expect(getWikipediaPageLinks).toHaveBeenCalledWith('Anthropic');
        expect(JSON.parse(out)).toEqual(['Claude', 'AI safety']);
    });

    it('rejects empty title input', async () => {
        await expect(
            getRelatedArticles.execute({ title: '' }, { tavilyApiKey: 'x' }),
        ).rejects.toThrow(/title/);
    });
});
