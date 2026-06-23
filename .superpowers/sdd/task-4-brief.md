### Task 4: Tavily web-search client + fixture test

**Files:**
- Create: `src/clients/tavily/searchWeb.ts`
- Create fixture: `src/__fixtures__/tavilySearch.json`
- Test: `src/__tests__/clients/tavily/searchWeb.test.ts`

**Interfaces:**
- Produces: `searchWeb(query: string, apiKey: string, maxResults?: number): Promise<{ title: string; url: string; snippet: string }[]>`

- [ ] **Step 1: Create the fixture**

Create `src/__fixtures__/tavilySearch.json` with a real-shaped Tavily response (capture with a key if available, else author this minimal shape):

```json
{
  "results": [
    {
      "title": "Anthropic",
      "url": "https://www.anthropic.com",
      "content": "Anthropic is an AI safety company founded in 2021."
    },
    {
      "title": "Anthropic - Wikipedia",
      "url": "https://en.wikipedia.org/wiki/Anthropic",
      "content": "Anthropic PBC is an American AI startup."
    }
  ]
}
```

- [ ] **Step 2: Write the failing test**

`src/__tests__/clients/tavily/searchWeb.test.ts`:

```ts
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
      async () => new Response(JSON.stringify(fixture)),
    );
    vi.stubGlobal('fetch', fetchMock);
    await searchWeb('test query', 'tvly-secret', 3);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.api_key).toBe('tvly-secret');
    expect(body.query).toBe('test query');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/clients/tavily/searchWeb.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `searchWeb`**

`src/clients/tavily/searchWeb.ts`:

```ts
/** Calls the Tavily search API and maps results to title/url/snippet. The
 * API key is passed in (read from server config) rather than read here. */
const TAVILY_API = 'https://api.tavily.com/search';

type WebResult = { title: string; url: string; snippet: string };

export async function searchWeb(
  query: string,
  apiKey: string,
  maxResults = 5,
): Promise<WebResult[]> {
  const response = await fetch(TAVILY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
    }),
  });
  if (!response.ok) {
    throw new Error(`Tavily search failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    results?: { title: string; url: string; content: string }[];
  };
  return (data.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
  }));
}
```

- [ ] **Step 5: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/clients/tavily/searchWeb.test.ts`
Expected: PASS (2 tests).

```bash
git add src/clients/tavily src/__tests__/clients/tavily src/__fixtures__/tavilySearch.json
git commit -m "feat: add Tavily web-search client with fixture test"
```

---

