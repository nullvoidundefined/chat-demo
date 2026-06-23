import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWikipediaPage } from '@/clients/wikipedia/getWikipediaPage';

const fixture = JSON.parse(
    readFileSync(resolve(__dirname, '../../../__fixtures__/wikipediaPage.json'), 'utf8'),
);

describe('getWikipediaPage', () => {
    beforeEach(() => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(fixture))),
        );
    });
    afterEach(() => vi.unstubAllGlobals());

    it('returns the plain-text extract for the page', async () => {
        const page = await getWikipediaPage('Anthropic');
        expect(page.title).toBeTruthy();
        expect(page.extract.length).toBeGreaterThan(0);
        // The real Anthropic article fixture (17 723 chars) exceeds MAX_ARTICLE_CHARS (6 000),
        // so the result is truncated. Asserting the actual fixture behaviour rather than a
        // synthetic assumption.
        expect(page.truncated).toBe(true);
        expect(page.extract.length).toBeLessThanOrEqual(6000);
    });

    it('truncates extracts longer than the char budget', async () => {
        const long = { ...fixture };
        const pageId = Object.keys(long.query.pages)[0];
        long.query.pages[pageId].extract = 'x'.repeat(10000);
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(long))),
        );
        const page = await getWikipediaPage('Anthropic');
        expect(page.truncated).toBe(true);
        expect(page.extract.length).toBeLessThanOrEqual(6000);
    });

    it('does not truncate extracts shorter than the char budget', async () => {
        const short = { ...fixture };
        const pageId = Object.keys(short.query.pages)[0];
        const shortExtract = 'x'.repeat(100);
        short.query.pages[pageId].extract = shortExtract;
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(short))),
        );
        const page = await getWikipediaPage('Anthropic');
        expect(page.truncated).toBe(false);
        expect(page.extract).toBe(shortExtract);
    });
});
