import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWikipediaPageLinks } from '@/clients/wikipedia/getWikipediaPageLinks';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/wikipediaLinks.json'),
    'utf8',
  ),
);

describe('getWikipediaPageLinks', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(fixture))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns a flat list of related article titles', async () => {
    const links = await getWikipediaPageLinks('Anthropic');
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBeGreaterThan(0);
    expect(typeof links[0]).toBe('string');
  });
});
