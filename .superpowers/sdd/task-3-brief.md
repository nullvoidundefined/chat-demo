### Task 3: Wikipedia client functions + fixture tests

**Files:**
- Create: `src/clients/wikipedia/searchWikipediaArticles.ts`, `src/clients/wikipedia/getWikipediaPage.ts`, `src/clients/wikipedia/getWikipediaPageLinks.ts`
- Create fixtures: `src/__fixtures__/wikipediaSearch.json`, `src/__fixtures__/wikipediaPage.json`, `src/__fixtures__/wikipediaLinks.json`
- Test: `src/__tests__/clients/wikipedia/searchWikipediaArticles.test.ts`, `.../getWikipediaPage.test.ts`, `.../getWikipediaPageLinks.test.ts`

**Interfaces:**
- Produces:
  - `searchWikipediaArticles(query: string, limit?: number): Promise<{ title: string; snippet: string }[]>`
  - `getWikipediaPage(title: string): Promise<{ title: string; extract: string; truncated: boolean }>`
  - `getWikipediaPageLinks(title: string): Promise<string[]>`
- Each uses global `fetch` against `https://en.wikipedia.org/w/api.php`.

- [ ] **Step 1: Capture real fixtures**

Run (saves real MediaWiki responses to commit as parser fixtures):

```bash
mkdir -p src/__fixtures__
curl -s 'https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=Anthropic&srlimit=3&format=json' > src/__fixtures__/wikipediaSearch.json
curl -s 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&titles=Anthropic&format=json' > src/__fixtures__/wikipediaPage.json
curl -s 'https://en.wikipedia.org/w/api.php?action=query&prop=links&plnamespace=0&pllimit=20&redirects=1&titles=Anthropic&format=json' > src/__fixtures__/wikipediaLinks.json
```

Expected: three non-empty JSON files. (If offline, hand-author minimal fixtures matching the MediaWiki shape: `query.search[].{title,snippet}`, `query.pages[id].extract`, `query.pages[id].links[].title`.)

- [ ] **Step 2: Write failing test for `searchWikipediaArticles`**

`src/__tests__/clients/wikipedia/searchWikipediaArticles.test.ts`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/wikipediaSearch.json'),
    'utf8',
  ),
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/clients/wikipedia/searchWikipediaArticles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `searchWikipediaArticles`**

`src/clients/wikipedia/searchWikipediaArticles.ts`:

```ts
/** Searches Wikipedia article titles via the MediaWiki API and returns
 * title/snippet pairs with HTML markup removed. */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

type SearchResult = { title: string; snippet: string };

export async function searchWikipediaArticles(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Wikipedia search failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    query?: { search?: { title: string; snippet: string }[] };
  };
  const hits = data.query?.search ?? [];
  return hits.map((hit) => ({
    title: hit.title,
    snippet: stripHtml(hit.snippet),
  }));
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').trim();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/clients/wikipedia/searchWikipediaArticles.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write failing test for `getWikipediaPage`**

`src/__tests__/clients/wikipedia/getWikipediaPage.test.ts`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getWikipediaPage } from '@/clients/wikipedia/getWikipediaPage';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/wikipediaPage.json'),
    'utf8',
  ),
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
    expect(page.truncated).toBe(false);
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
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/__tests__/clients/wikipedia/getWikipediaPage.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 8: Implement `getWikipediaPage`**

`src/clients/wikipedia/getWikipediaPage.ts`:

```ts
/** Fetches a Wikipedia page's plain-text extract via the MediaWiki API,
 * truncating to MAX_ARTICLE_CHARS to bound context size. */
import { MAX_ARTICLE_CHARS } from '@/constants/agent';

const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

type WikipediaPage = { title: string; extract: string; truncated: boolean };

export async function getWikipediaPage(title: string): Promise<WikipediaPage> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    titles: title,
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Wikipedia page fetch failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { title?: string; extract?: string }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.extract === undefined) {
    throw new Error(`Wikipedia page not found: ${title}`);
  }
  const full = page.extract;
  const truncated = full.length > MAX_ARTICLE_CHARS;
  return {
    title: page.title ?? title,
    extract: truncated ? full.slice(0, MAX_ARTICLE_CHARS) : full,
    truncated,
  };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/__tests__/clients/wikipedia/getWikipediaPage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Write failing test for `getWikipediaPageLinks`**

`src/__tests__/clients/wikipedia/getWikipediaPageLinks.test.ts`:

```ts
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
```

- [ ] **Step 11: Run test to verify it fails, then implement**

Run: `npx vitest run src/__tests__/clients/wikipedia/getWikipediaPageLinks.test.ts`
Expected: FAIL (module not found).

`src/clients/wikipedia/getWikipediaPageLinks.ts`:

```ts
/** Fetches the titles of articles linked from a Wikipedia page (namespace 0),
 * used as the agent's "related articles" signal. */
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

export async function getWikipediaPageLinks(title: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'links',
    plnamespace: '0',
    pllimit: '20',
    redirects: '1',
    titles: title,
    format: 'json',
    origin: '*',
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) {
    throw new Error(`Wikipedia links fetch failed: ${response.status}`);
  }
  const data = (await response.json()) as {
    query?: { pages?: Record<string, { links?: { title: string }[] }> };
  };
  const pages = data.query?.pages ?? {};
  const page = Object.values(pages)[0];
  return (page?.links ?? []).map((link) => link.title);
}
```

- [ ] **Step 12: Run all Wikipedia tests and commit**

Run: `npx vitest run src/__tests__/clients/wikipedia`
Expected: PASS (5 tests across 3 files).

```bash
git add src/clients/wikipedia src/__tests__/clients/wikipedia src/__fixtures__
git commit -m "feat: add Wikipedia REST client functions with fixture tests"
```

---

