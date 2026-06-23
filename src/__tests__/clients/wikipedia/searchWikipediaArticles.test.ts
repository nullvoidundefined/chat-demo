import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';

const fixture = JSON.parse(
    readFileSync(resolve(__dirname, '../../../__fixtures__/wikipediaSearch.json'), 'utf8'),
);

describe('searchWikipediaArticles', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(fixture))),
        );
    });
    afterEach(() => vi.unstubAllGlobals());

    it('maps the real MediaWiki search response to title/snippet pairs', async () => {
        const results = await searchWikipediaArticles('Anthropic', 3);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('snippet');
        expect(typeof results[0].title).toBe('string');
    });

    it('strips HTML markup from snippets', async () => {
        const results = await searchWikipediaArticles('Anthropic', 3);
        expect(results.every((r) => !/<[^>]+>/.test(r.snippet))).toBe(true);
    });
});
