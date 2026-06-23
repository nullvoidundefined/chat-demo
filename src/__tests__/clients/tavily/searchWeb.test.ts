import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWeb } from '@/clients/tavily/searchWeb';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/tavilySearch.json'),
    'utf8',
  ),
);

describe('searchWeb', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(fixture))),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('maps Tavily results to title/url/snippet', async () => {
    const results = await searchWeb('Anthropic', 'tvly-test', 5);
    expect(results[0]).toEqual({
      title: 'Anthropic',
      url: 'https://www.anthropic.com',
      snippet: 'Anthropic is an AI safety company founded in 2021.',
    });
  });

  it('sends the api key and query in the POST body', async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify(fixture)),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchWeb('test query', 'tvly-secret', 3);
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body));
    expect(body.api_key).toBe('tvly-secret');
    expect(body.query).toBe('test query');
  });
});
