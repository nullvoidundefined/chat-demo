# Tool-Use Research Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an educational MVP of a streaming, tool-using research chatbot (Wikipedia + web search) with an offline LLM-judge eval harness, in a single Next.js app.

**Architecture:** One Next.js App Router app. A server-side tool-use loop (`runResearchAgent`) emits events to an `AgentSink` callback; the `/api/chat` route supplies an SSE sink for the browser, and the eval harness supplies a collecting sink so it tests the real agent. Tools are custom client-side tools that call thin provider clients (Wikipedia REST, Tavily). The judge scores agent outputs against a rubric via structured output.

**Tech Stack:** Next.js 16, TypeScript, React, SCSS modules, Radix UI, `@anthropic-ai/sdk`, Zod, Vitest. Anthropic API with adaptive thinking.

## Global Constraints

- Models: `AGENT_MODEL = 'claude-opus-4-8'`, `JUDGE_MODEL = 'claude-opus-4-8'` (single constants module; both swappable).
- Anthropic calls use `thinking: { type: 'adaptive', display: 'summarized' }` and `output_config: { effort: 'high' }`. Never send `temperature`/`top_p`/`top_k`/`budget_tokens` (they 400 on Opus 4.8).
- `MAX_AGENT_ITERATIONS = 8`.
- No em dash (U+2014) anywhere. No database, no auth, no persistence.
- Prettier: 4-space indent, 100 print width, trailing commas, single quotes (per shared CLAUDE.md, which always overrides a project config; Doppelscript's 2-space/80 is not carried over). ESLint flat config copied from Doppelscript web (no formatting conflict). Code samples below use 2-space for compactness; `npm run format` normalizes them to the 4-space/100 config.
- One exported function per file in `services/`, `api/`, `clients/`, `tools/`. Tests in `src/__tests__/` mirroring source; fixtures in `src/__fixtures__/`.
- File-level header comment (`/** */`) on every non-test source file.
- Tool input is always read from parsed `block.input`, never by string-matching serialized JSON.
- Node 24 global `fetch` is used for provider clients (no extra HTTP dependency).

---

### Task 1: Project scaffold, configs, constants, types

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `prettier.config.mjs`, `eslint.config.mjs`, `.env.example`, `vitest.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.scss`
- Create: `src/constants/models.ts`, `src/constants/agent.ts`, `src/types/chat.ts`, `src/types/eval.ts`

**Interfaces:**
- Produces: `AGENT_MODEL`, `JUDGE_MODEL` (string), `MAX_AGENT_ITERATIONS`, `EFFORT` (`'high'`), `MAX_ARTICLE_CHARS` (number); types `ChatRole`, `ChatMessage`, `ToolStep`, `SseEvent`, `EvalItem`, `EvalResult`, `Score`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "chat-demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": "24.x" },
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "eslint .",
    "format": "prettier --write '**/*.{ts,tsx,mjs,scss,md}'",
    "test": "vitest run",
    "test:watch": "vitest",
    "eval": "tsx evals/runEval.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.70.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.7.0",
    "eslint": "^9.0.0",
    "jsdom": "^25.0.0",
    "prettier": "^3.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `prettier.config.mjs` (shared CLAUDE.md formatting)**

Use Doppelscript's web config as the structural base, but defer the formatting
values to the shared CLAUDE.md (4-space indent, 100 print width, trailing
commas). Do not carry over Doppelscript's 2-space/80-width values. The
`@trivago` import-sort plugin is dropped to avoid an extra dependency; ESLint's
`unused-imports` plugin still handles unused imports.

`prettier.config.mjs`:

```js
// Prettier config. Formatting follows the shared CLAUDE.md: 4-space indent,
// 100 print width, trailing commas. Shared CLAUDE.md overrides project config.
export default {
  arrowParens: 'always',
  bracketSpacing: true,
  printWidth: 100,
  semi: true,
  singleQuote: true,
  tabWidth: 4,
  trailingComma: 'all',
  useTabs: false,
};
```

- [ ] **Step 3: Copy `eslint.config.mjs` from Doppelscript web and trim**

Run: `cp /Users/iangreenough/Desktop/code/personal/production/doppelscript/apps/client/web/eslint.config.mjs ./eslint.config.mjs`
Then remove the project-specific `no-restricted-syntax` block that forces `@/services/api` (this repo has its own `api/` shape). Keep `next/core-web-vitals`, `next/typescript`, security, jsx-a11y, and the `react/forbid-dom-props` inline-style rule.

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Create `next.config.ts` and `vitest.config.ts`**

`next.config.ts`:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
```

- [ ] **Step 6: Create `src/__tests__/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Create constants**

`src/constants/models.ts`:

```ts
/** Model identifiers and Anthropic call tuning. Swap AGENT_MODEL to
 * 'claude-sonnet-4-6' to reduce eval cost. */
export const AGENT_MODEL = 'claude-opus-4-8';
export const JUDGE_MODEL = 'claude-opus-4-8';
export const EFFORT = 'high' as const;
export const MAX_TOKENS = 8000;
```

`src/constants/agent.ts`:

```ts
/** Agent-loop and tool-output limits. */
export const MAX_AGENT_ITERATIONS = 8;
export const MAX_ARTICLE_CHARS = 6000;
export const DEFAULT_SEARCH_LIMIT = 5;
```

- [ ] **Step 8: Create types**

`src/types/chat.ts`:

```ts
/** Shared chat and streaming types used by the agent, route, and UI. */
export type ChatRole = 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ToolStep = {
  name: string;
  input: unknown;
  summary: string | null;
};

export type SseEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; summary: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
```

`src/types/eval.ts`:

```ts
/** Types for the offline eval dataset, run output, and judge scores. */
export type EvalItem = {
  id: string;
  question: string;
  rubric: string;
  referenceFacts?: string[];
};

export type EvalRunOutput = {
  finalAnswer: string;
  toolsUsed: string[];
  iterationCount: number;
};

export type Score = {
  factuality: number;
  citationUse: number;
  completeness: number;
  toolEfficiency: number;
  rationale: string;
  pass: boolean;
};

export type EvalResult = {
  item: EvalItem;
  run: EvalRunOutput;
  score: Score;
};
```

- [ ] **Step 9: Create minimal app shell**

`src/app/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import './globals.scss';

export const metadata = { title: 'Research Chatbot' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Chat coming soon</main>;
}
```

`src/app/globals.scss`:

```scss
:root {
  color-scheme: light dark;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 10: Create `.env.example` and `next-env.d.ts` placeholder**

`.env.example`:

```
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
```

Run: `npm install`
Expected: dependencies install; `npx next telemetry disable` optional. `next-env.d.ts` is generated by Next on first `dev`/`build`.

- [ ] **Step 11: Verify typecheck and commit**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

```bash
git add -A
git commit -m "chore: scaffold Next.js app, configs, constants, and types"
```

---

### Task 2: Env config loader (fail-fast)

**Files:**
- Create: `src/config/loadServerConfig.ts`
- Test: `src/__tests__/config/loadServerConfig.test.ts`

**Interfaces:**
- Produces: `loadServerConfig(): { anthropicApiKey: string; tavilyApiKey: string }` — throws a clear `Error` if either env var is missing or empty.

- [ ] **Step 1: Write the failing test**

`src/__tests__/config/loadServerConfig.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadServerConfig } from '@/config/loadServerConfig';

describe('loadServerConfig', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.TAVILY_API_KEY = 'tvly-test';
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it('returns both keys when present', () => {
    expect(loadServerConfig()).toEqual({
      anthropicApiKey: 'sk-ant-test',
      tavilyApiKey: 'tvly-test',
    });
  });

  it('throws naming the missing variable', () => {
    delete process.env.TAVILY_API_KEY;
    expect(() => loadServerConfig()).toThrow(/TAVILY_API_KEY/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/config/loadServerConfig.test.ts`
Expected: FAIL with "Cannot find module '@/config/loadServerConfig'".

- [ ] **Step 3: Write the implementation**

`src/config/loadServerConfig.ts`:

```ts
/** Loads and validates server-only environment variables. Throws a clear
 * error naming any missing variable so startup fails fast. */
type ServerConfig = {
  anthropicApiKey: string;
  tavilyApiKey: string;
};

export function loadServerConfig(): ServerConfig {
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
  const tavilyApiKey = requireEnv('TAVILY_API_KEY');

  return { anthropicApiKey, tavilyApiKey };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/config/loadServerConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config src/__tests__/config
git commit -m "feat: add fail-fast server env config loader"
```

---

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

### Task 5: Anthropic client + tools + registry + executeToolCall

**Files:**
- Create: `src/clients/anthropic/createAnthropicClient.ts`
- Create: `src/tools/searchWikipedia.ts`, `src/tools/getWikipediaArticle.ts`, `src/tools/getRelatedArticles.ts`, `src/tools/webSearch.ts`
- Create: `src/services/agent/toolRegistry.ts`, `src/services/agent/executeToolCall.ts`
- Test: `src/__tests__/tools/searchWikipedia.test.ts`, `.../webSearch.test.ts`, `src/__tests__/services/agent/executeToolCall.test.ts`

**Interfaces:**
- Produces:
  - `createAnthropicClient(apiKey: string): Anthropic`
  - Each tool module default-exports `AgentTool`: `{ schema: Anthropic.Tool; execute: (input: unknown, deps: ToolDeps) => Promise<string> }` where `ToolDeps = { tavilyApiKey: string }`.
  - `toolRegistry: Record<string, AgentTool>` and `toolSchemas: Anthropic.Tool[]`.
  - `executeToolCall(name: string, input: unknown, deps: ToolDeps): Promise<{ content: string; isError: boolean }>`.
- Tool `execute` returns a JSON string (the `tool_result` content).

- [ ] **Step 1: Define the shared `AgentTool` type and Anthropic client**

`src/tools/agentTool.ts`:

```ts
/** Shared shape for an agent tool: an Anthropic schema plus an execute()
 * that returns the tool_result content string. */
import type Anthropic from '@anthropic-ai/sdk';

export type ToolDeps = { tavilyApiKey: string };

export type AgentTool = {
  schema: Anthropic.Tool;
  execute: (input: unknown, deps: ToolDeps) => Promise<string>;
};
```

`src/clients/anthropic/createAnthropicClient.ts`:

```ts
/** Constructs an Anthropic SDK client from an explicit API key. */
import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}
```

- [ ] **Step 2: Write failing test for `searchWikipedia` tool**

`src/__tests__/tools/searchWikipedia.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/wikipedia/searchWikipediaArticles', () => ({
  searchWikipediaArticles: vi.fn(async () => [
    { title: 'Anthropic', snippet: 'AI safety company' },
  ]),
}));

import searchWikipedia from '@/tools/searchWikipedia';
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';

describe('searchWikipedia tool', () => {
  afterEach(() => vi.clearAllMocks());

  it('has a name and required query in its schema', () => {
    expect(searchWikipedia.schema.name).toBe('search_wikipedia');
    expect(searchWikipedia.schema.input_schema.required).toContain('query');
  });

  it('calls the client and returns the results as a JSON string', async () => {
    const out = await searchWikipedia.execute(
      { query: 'Anthropic' },
      { tavilyApiKey: 'x' },
    );
    expect(searchWikipediaArticles).toHaveBeenCalledWith('Anthropic', 5);
    expect(JSON.parse(out)[0].title).toBe('Anthropic');
  });

  it('rejects empty query input', async () => {
    await expect(
      searchWikipedia.execute({ query: '' }, { tavilyApiKey: 'x' }),
    ).rejects.toThrow(/query/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement the tool**

Run: `npx vitest run src/__tests__/tools/searchWikipedia.test.ts`
Expected: FAIL (module not found).

`src/tools/searchWikipedia.ts`:

```ts
/** Agent tool: search Wikipedia article titles. Wraps the Wikipedia client
 * and validates input before calling it. */
import { searchWikipediaArticles } from '@/clients/wikipedia/searchWikipediaArticles';
import { DEFAULT_SEARCH_LIMIT } from '@/constants/agent';
import type { AgentTool } from '@/tools/agentTool';

const searchWikipedia: AgentTool = {
  schema: {
    name: 'search_wikipedia',
    description:
      'Search Wikipedia for article titles matching a query. Call this first ' +
      'when you need to find which articles exist about a topic, person, ' +
      'company, or event.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms' },
        limit: { type: 'integer', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  execute: async (input) => {
    const { query, limit } = input as { query?: string; limit?: number };
    if (!query || !query.trim()) {
      throw new Error('search_wikipedia requires a non-empty query');
    }
    const results = await searchWikipediaArticles(
      query,
      limit ?? DEFAULT_SEARCH_LIMIT,
    );
    return JSON.stringify(results);
  },
};

export default searchWikipedia;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/tools/searchWikipedia.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the remaining three tools (no new test concepts; mirror the pattern)**

`src/tools/getWikipediaArticle.ts`:

```ts
/** Agent tool: fetch the plain-text extract of a Wikipedia article. */
import { getWikipediaPage } from '@/clients/wikipedia/getWikipediaPage';
import type { AgentTool } from '@/tools/agentTool';

const getWikipediaArticle: AgentTool = {
  schema: {
    name: 'get_wikipedia_article',
    description:
      'Fetch the full plain-text content of a Wikipedia article by its exact ' +
      'title. Call this after search_wikipedia to read an article you found.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Exact article title' },
      },
      required: ['title'],
    },
  },
  execute: async (input) => {
    const { title } = input as { title?: string };
    if (!title || !title.trim()) {
      throw new Error('get_wikipedia_article requires a non-empty title');
    }
    const page = await getWikipediaPage(title);
    return JSON.stringify(page);
  },
};

export default getWikipediaArticle;
```

`src/tools/getRelatedArticles.ts`:

```ts
/** Agent tool: list articles related to (linked from) a Wikipedia page. */
import { getWikipediaPageLinks } from '@/clients/wikipedia/getWikipediaPageLinks';
import type { AgentTool } from '@/tools/agentTool';

const getRelatedArticles: AgentTool = {
  schema: {
    name: 'get_related_articles',
    description:
      'List Wikipedia article titles related to (linked from) a given ' +
      'article. Call this to discover adjacent topics worth reading.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Exact article title' },
      },
      required: ['title'],
    },
  },
  execute: async (input) => {
    const { title } = input as { title?: string };
    if (!title || !title.trim()) {
      throw new Error('get_related_articles requires a non-empty title');
    }
    const links = await getWikipediaPageLinks(title);
    return JSON.stringify(links);
  },
};

export default getRelatedArticles;
```

`src/tools/webSearch.ts`:

```ts
/** Agent tool: general web search via Tavily, for current or
 * non-encyclopedic information not covered well by Wikipedia. */
import { searchWeb } from '@/clients/tavily/searchWeb';
import type { AgentTool } from '@/tools/agentTool';

const webSearch: AgentTool = {
  schema: {
    name: 'web_search',
    description:
      'Search the web for current or non-encyclopedic information. Call this ' +
      'when Wikipedia is unlikely to cover the topic, or you need recent news.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms' },
      },
      required: ['query'],
    },
  },
  execute: async (input, deps) => {
    const { query } = input as { query?: string };
    if (!query || !query.trim()) {
      throw new Error('web_search requires a non-empty query');
    }
    const results = await searchWeb(query, deps.tavilyApiKey);
    return JSON.stringify(results);
  },
};

export default webSearch;
```

- [ ] **Step 6: Write failing test for `webSearch` tool (verifies dep is passed)**

`src/__tests__/tools/webSearch.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/clients/tavily/searchWeb', () => ({
  searchWeb: vi.fn(async () => [
    { title: 'A', url: 'https://a.com', snippet: 's' },
  ]),
}));

import webSearch from '@/tools/webSearch';
import { searchWeb } from '@/clients/tavily/searchWeb';

describe('webSearch tool', () => {
  afterEach(() => vi.clearAllMocks());

  it('passes the tavily api key from deps to the client', async () => {
    await webSearch.execute({ query: 'news' }, { tavilyApiKey: 'tvly-x' });
    expect(searchWeb).toHaveBeenCalledWith('news', 'tvly-x');
  });

  it('rejects empty query', async () => {
    await expect(
      webSearch.execute({ query: '   ' }, { tavilyApiKey: 'tvly-x' }),
    ).rejects.toThrow(/query/);
  });
});
```

- [ ] **Step 7: Run webSearch test**

Run: `npx vitest run src/__tests__/tools/webSearch.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Create the registry**

`src/services/agent/toolRegistry.ts`:

```ts
/** Maps tool names to their AgentTool and exposes the schema list for the
 * Anthropic request. */
import getRelatedArticles from '@/tools/getRelatedArticles';
import getWikipediaArticle from '@/tools/getWikipediaArticle';
import searchWikipedia from '@/tools/searchWikipedia';
import webSearch from '@/tools/webSearch';
import type { AgentTool } from '@/tools/agentTool';
import type Anthropic from '@anthropic-ai/sdk';

export const toolRegistry: Record<string, AgentTool> = {
  search_wikipedia: searchWikipedia,
  get_wikipedia_article: getWikipediaArticle,
  get_related_articles: getRelatedArticles,
  web_search: webSearch,
};

export const toolSchemas: Anthropic.Tool[] = Object.values(toolRegistry).map(
  (tool) => tool.schema,
);
```

- [ ] **Step 9: Write failing test for `executeToolCall`**

`src/__tests__/services/agent/executeToolCall.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/toolRegistry', () => ({
  toolRegistry: {
    ok_tool: { execute: vi.fn(async () => '{"ok":true}') },
    boom_tool: {
      execute: vi.fn(async () => {
        throw new Error('kaboom');
      }),
    },
  },
}));

import { executeToolCall } from '@/services/agent/executeToolCall';

describe('executeToolCall', () => {
  afterEach(() => vi.clearAllMocks());

  it('returns content with isError false on success', async () => {
    const out = await executeToolCall('ok_tool', {}, { tavilyApiKey: 'x' });
    expect(out).toEqual({ content: '{"ok":true}', isError: false });
  });

  it('returns isError true with the message when the tool throws', async () => {
    const out = await executeToolCall('boom_tool', {}, { tavilyApiKey: 'x' });
    expect(out.isError).toBe(true);
    expect(out.content).toMatch(/kaboom/);
  });

  it('returns isError true for an unknown tool name', async () => {
    const out = await executeToolCall('nope', {}, { tavilyApiKey: 'x' });
    expect(out.isError).toBe(true);
    expect(out.content).toMatch(/unknown tool/i);
  });
});
```

- [ ] **Step 10: Run test to verify it fails, then implement**

Run: `npx vitest run src/__tests__/services/agent/executeToolCall.test.ts`
Expected: FAIL (module not found).

`src/services/agent/executeToolCall.ts`:

```ts
/** Executes one tool by name, converting any failure into a structured
 * error result so the agent loop can feed it back to the model. */
import { toolRegistry } from '@/services/agent/toolRegistry';
import type { ToolDeps } from '@/tools/agentTool';

type ToolCallResult = { content: string; isError: boolean };

export async function executeToolCall(
  name: string,
  input: unknown,
  deps: ToolDeps,
): Promise<ToolCallResult> {
  const tool = toolRegistry[name];
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  try {
    const content = await tool.execute(input, deps);
    return { content, isError: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: `Tool error: ${message}`, isError: true };
  }
}
```

- [ ] **Step 11: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/tools src/__tests__/services/agent/executeToolCall.test.ts`
Expected: PASS (8 tests).

```bash
git add src/tools src/clients/anthropic src/services/agent/toolRegistry.ts src/services/agent/executeToolCall.ts src/__tests__/tools src/__tests__/services/agent/executeToolCall.test.ts
git commit -m "feat: add Anthropic client, four agent tools, registry, and executeToolCall"
```

---

### Task 6: AgentSink + SSE encoder + the agent loop

**Files:**
- Create: `src/services/agent/agentSink.ts`, `src/services/sse/encodeSseEvent.ts`, `src/services/agent/runResearchAgent.ts`, `src/prompts/researchSystemPrompt.ts`
- Test: `src/__tests__/services/sse/encodeSseEvent.test.ts`, `src/__tests__/services/agent/runResearchAgent.test.ts`

**Interfaces:**
- Produces:
  - `AgentSink` (callback interface, see code).
  - `encodeSseEvent(event: SseEvent): string` — returns `data: <json>\n\n`.
  - `RESEARCH_SYSTEM_PROMPT: string`.
  - `runResearchAgent(messages: Anthropic.MessageParam[], opts: { client: Anthropic; sink: AgentSink; deps: ToolDeps }): Promise<void>`.

- [ ] **Step 1: Create `agentSink.ts`**

`src/services/agent/agentSink.ts`:

```ts
/** Callback interface the agent loop calls as events occur, decoupling the
 * loop from its consumer (SSE route vs eval collector).
 *
 * TODO(future): migrate to an async generator (the loop yields events and
 * callers `for await` them). Callback form chosen for readability here. */
export type AgentSink = {
  onThinking: (delta: string) => void;
  onText: (delta: string) => void;
  onToolCall: (name: string, input: unknown) => void;
  onToolResult: (name: string, summary: string) => void;
  onDone: (finalText: string) => void;
  onError: (message: string) => void;
};
```

- [ ] **Step 2: Write failing test for `encodeSseEvent`**

`src/__tests__/services/sse/encodeSseEvent.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { encodeSseEvent } from '@/services/sse/encodeSseEvent';
import type { SseEvent } from '@/types/chat';

describe('encodeSseEvent', () => {
  it('round-trips an event through the SSE wire format', () => {
    const event: SseEvent = { type: 'text', delta: 'hello' };
    const wire = encodeSseEvent(event);
    expect(wire.startsWith('data: ')).toBe(true);
    expect(wire.endsWith('\n\n')).toBe(true);
    const parsed = JSON.parse(wire.slice('data: '.length).trim());
    expect(parsed).toEqual(event);
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement**

Run: `npx vitest run src/__tests__/services/sse/encodeSseEvent.test.ts`
Expected: FAIL (module not found).

`src/services/sse/encodeSseEvent.ts`:

```ts
/** Serializes one SseEvent into a Server-Sent Events `data:` frame. */
import type { SseEvent } from '@/types/chat';

export function encodeSseEvent(event: SseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/sse/encodeSseEvent.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Create the system prompt**

`src/prompts/researchSystemPrompt.ts`:

```ts
/** System prompt for the research agent. Instructs grounded, cited answers
 * and judicious tool use. */
export const RESEARCH_SYSTEM_PROMPT = [
  'You are a research assistant. Answer the user by gathering information',
  'with your tools, then writing a clear, well-organized synthesis.',
  '',
  'Guidelines:',
  '- Prefer search_wikipedia and get_wikipedia_article for encyclopedic',
  '  topics (people, companies, history, science).',
  '- Use web_search for current events or topics Wikipedia covers poorly.',
  '- Use get_related_articles to find adjacent topics worth including.',
  '- Cite the article titles or URLs you drew facts from.',
  '- If sources conflict or are thin, say so rather than guessing.',
  '- Stop calling tools once you have enough to answer well.',
].join('\n');
```

- [ ] **Step 6: Write the failing test for `runResearchAgent`**

This test uses a fake Anthropic client whose `messages.stream` returns a scripted async iterable plus `finalMessage()`. It verifies the loop drives tool calls, terminates on `end_turn`, surfaces the iteration cap, and reports tool errors via the sink.

`src/__tests__/services/agent/runResearchAgent.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/executeToolCall', () => ({
  executeToolCall: vi.fn(async () => ({ content: '[]', isError: false })),
}));
vi.mock('@/services/agent/toolRegistry', () => ({ toolSchemas: [] }));

import { runResearchAgent } from '@/services/agent/runResearchAgent';
import { executeToolCall } from '@/services/agent/executeToolCall';

type FinalMessage = {
  stop_reason: string;
  content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
};

function fakeStream(final: FinalMessage) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
    },
    finalMessage: async () => final,
  };
}

function fakeClient(finals: FinalMessage[]) {
  let call = 0;
  return {
    messages: { stream: vi.fn(() => fakeStream(finals[call++])) },
  } as never;
}

function makeSink() {
  return {
    onThinking: vi.fn(),
    onText: vi.fn(),
    onToolCall: vi.fn(),
    onToolResult: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

const deps = { tavilyApiKey: 'x' };

describe('runResearchAgent', () => {
  afterEach(() => vi.clearAllMocks());

  it('calls onDone with the final text when the model ends its turn', async () => {
    const client = fakeClient([
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Answer.' }] },
    ]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onDone).toHaveBeenCalledWith('Answer.');
    expect(sink.onToolCall).not.toHaveBeenCalled();
  });

  it('executes a tool call then continues to the final answer', async () => {
    const client = fakeClient([
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 't1', name: 'search_wikipedia', input: { query: 'x' } },
        ],
      },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] },
    ]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(executeToolCall).toHaveBeenCalledWith(
      'search_wikipedia',
      { query: 'x' },
      deps,
    );
    expect(sink.onToolCall).toHaveBeenCalledWith('search_wikipedia', { query: 'x' });
    expect(sink.onToolResult).toHaveBeenCalled();
    expect(sink.onDone).toHaveBeenCalledWith('Done.');
  });

  it('calls onError when a refusal is returned', async () => {
    const client = fakeClient([{ stop_reason: 'refusal', content: [] }]);
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onError).toHaveBeenCalled();
    expect(sink.onDone).not.toHaveBeenCalled();
  });

  it('calls onError when the iteration cap is exceeded', async () => {
    const toolFinal: FinalMessage = {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', id: 't', name: 'web_search', input: { query: 'x' } }],
    };
    const client = fakeClient(Array.from({ length: 10 }, () => toolFinal));
    const sink = makeSink();
    await runResearchAgent([{ role: 'user', content: 'q' }], {
      client,
      sink,
      deps,
    });
    expect(sink.onError).toHaveBeenCalledWith(
      expect.stringMatching(/max.*iteration/i),
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run src/__tests__/services/agent/runResearchAgent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 8: Implement `runResearchAgent`**

`src/services/agent/runResearchAgent.ts`:

```ts
/** The tool-use loop. Streams model output to the sink, executes any tool
 * calls, and repeats until the model ends its turn, refuses, or the
 * iteration cap is hit. Decoupled from its consumer via AgentSink.
 *
 * TODO(future): yield events from an async generator instead of pushing to a
 * sink (see agentSink.ts). */
import { EFFORT, MAX_TOKENS, AGENT_MODEL } from '@/constants/models';
import { MAX_AGENT_ITERATIONS } from '@/constants/agent';
import { RESEARCH_SYSTEM_PROMPT } from '@/prompts/researchSystemPrompt';
import { executeToolCall } from '@/services/agent/executeToolCall';
import { toolSchemas } from '@/services/agent/toolRegistry';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type Anthropic from '@anthropic-ai/sdk';

type RunOptions = {
  client: Anthropic;
  sink: AgentSink;
  deps: ToolDeps;
};

export async function runResearchAgent(
  messages: Anthropic.MessageParam[],
  { client, sink, deps }: RunOptions,
): Promise<void> {
  const working = [...messages];

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const stream = client.messages.stream({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      system: RESEARCH_SYSTEM_PROMPT,
      tools: toolSchemas,
      messages: working,
      thinking: { type: 'adaptive', display: 'summarized' },
      output_config: { effort: EFFORT },
    } as Anthropic.MessageStreamParams);

    for await (const event of stream) {
      streamDeltaToSink(event, sink);
    }
    const final = await stream.finalMessage();
    working.push({ role: 'assistant', content: final.content });

    if (final.stop_reason === 'refusal') {
      sink.onError('The model declined to answer this request.');
      return;
    }
    if (final.stop_reason !== 'tool_use') {
      sink.onDone(textOf(final.content));
      return;
    }

    const toolResults = await runToolCalls(final.content, sink, deps);
    working.push({ role: 'user', content: toolResults });
  }

  sink.onError('Reached the maximum number of agent iterations.');
}

function streamDeltaToSink(event: unknown, sink: AgentSink): void {
  const typed = event as {
    type?: string;
    delta?: { type?: string; text?: string; thinking?: string };
  };
  if (typed.type !== 'content_block_delta' || !typed.delta) {
    return;
  }
  if (typed.delta.type === 'text_delta' && typed.delta.text) {
    sink.onText(typed.delta.text);
  } else if (typed.delta.type === 'thinking_delta' && typed.delta.thinking) {
    sink.onThinking(typed.delta.thinking);
  }
}

async function runToolCalls(
  content: Anthropic.ContentBlock[],
  sink: AgentSink,
  deps: ToolDeps,
): Promise<Anthropic.ToolResultBlockParam[]> {
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const block of content) {
    if (block.type !== 'tool_use') {
      continue;
    }
    sink.onToolCall(block.name, block.input);
    const { content: resultContent, isError } = await executeToolCall(
      block.name,
      block.input,
      deps,
    );
    sink.onToolResult(block.name, summarize(resultContent));
    results.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: resultContent,
      is_error: isError,
    });
  }
  return results;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

function summarize(content: string): string {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return `${parsed.length} result(s)`;
    }
    if (parsed && typeof parsed === 'object' && 'title' in parsed) {
      return `read "${(parsed as { title: string }).title}"`;
    }
  } catch {
    // not JSON; fall through
  }
  return content.length > 80 ? `${content.slice(0, 80)}...` : content;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/agent/runResearchAgent.test.ts`
Expected: PASS (4 tests). If the SDK's `MessageStreamParams` type rejects `output_config`/`thinking`, the `as Anthropic.MessageStreamParams` cast keeps the runtime call correct; do not remove the parameters.

- [ ] **Step 10: Commit**

```bash
git add src/services/agent/agentSink.ts src/services/agent/runResearchAgent.ts src/services/sse src/prompts/researchSystemPrompt.ts src/__tests__/services
git commit -m "feat: add agent sink, SSE encoder, and the tool-use research loop"
```

---

### Task 7: `/api/chat` SSE route

**Files:**
- Create: `src/app/api/chat/route.ts`
- Test: `src/__tests__/app/api/chat/route.test.ts`

**Interfaces:**
- Consumes: `runResearchAgent`, `loadServerConfig`, `createAnthropicClient`, `encodeSseEvent`.
- Produces: `POST(request: Request): Promise<Response>` returning `text/event-stream`. Request body: `{ messages: ChatMessage[] }`.

- [ ] **Step 1: Write the failing test**

The test mocks `runResearchAgent` to drive the sink, and asserts the response is an event stream whose body contains the encoded events.

`src/__tests__/app/api/chat/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/loadServerConfig', () => ({
  loadServerConfig: () => ({ anthropicApiKey: 'k', tavilyApiKey: 't' }),
}));
vi.mock('@/clients/anthropic/createAnthropicClient', () => ({
  createAnthropicClient: () => ({}) as never,
}));
vi.mock('@/services/agent/runResearchAgent', () => ({
  runResearchAgent: vi.fn(async (_messages, { sink }) => {
    sink.onToolCall('search_wikipedia', { query: 'x' });
    sink.onToolResult('search_wikipedia', '3 result(s)');
    sink.onText('Answer.');
    sink.onDone('Answer.');
  }),
}));

import { POST } from '@/app/api/chat/route';

async function readBody(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value);
  }
  return out;
}

describe('POST /api/chat', () => {
  afterEach(() => vi.clearAllMocks());

  it('streams the agent events as SSE frames', async () => {
    const request = new Request('http://test/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'q' }] }),
    });
    const response = await POST(request);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const body = await readBody(response);
    expect(body).toContain('"type":"tool_call"');
    expect(body).toContain('"type":"done"');
  });

  it('returns 400 when messages are missing', async () => {
    const request = new Request('http://test/api/chat', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/app/api/chat/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the route**

`src/app/api/chat/route.ts`:

```ts
/** POST /api/chat - runs the research agent and streams its events to the
 * browser as Server-Sent Events. */
import { createAnthropicClient } from '@/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '@/config/loadServerConfig';
import { runResearchAgent } from '@/services/agent/runResearchAgent';
import { encodeSseEvent } from '@/services/sse/encodeSseEvent';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ChatMessage, SseEvent } from '@/types/chat';
import type Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
  } | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response('messages required', { status: 400 });
  }

  const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
  const client = createAnthropicClient(anthropicApiKey);
  const messages = body.messages.map(toMessageParam);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: SseEvent) =>
        controller.enqueue(encoder.encode(encodeSseEvent(event)));
      const sink = buildSink(send);
      try {
        await runResearchAgent(messages, {
          client,
          sink,
          deps: { tavilyApiKey },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}

function buildSink(send: (event: SseEvent) => void): AgentSink {
  return {
    onThinking: (delta) => send({ type: 'thinking', delta }),
    onText: (delta) => send({ type: 'text', delta }),
    onToolCall: (name, input) => send({ type: 'tool_call', name, input }),
    onToolResult: (name, summary) =>
      send({ type: 'tool_result', name, summary }),
    onDone: () => send({ type: 'done' }),
    onError: (message) => send({ type: 'error', message }),
  };
}

function toMessageParam(message: ChatMessage): Anthropic.MessageParam {
  return { role: message.role, content: message.content };
}
```

- [ ] **Step 4: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/app/api/chat/route.test.ts`
Expected: PASS (2 tests).

```bash
git add src/app/api/chat src/__tests__/app/api/chat
git commit -m "feat: add /api/chat SSE route streaming agent events"
```

---

### Task 8: Browser stream client + `useChatStream` hook

**Files:**
- Create: `src/api/streamChat.ts`, `src/state/useChatStream.ts`
- Test: `src/__tests__/state/useChatStream.test.tsx`

**Interfaces:**
- Produces:
  - `streamChat(messages: ChatMessage[], onEvent: (event: SseEvent) => void, signal?: AbortSignal): Promise<void>` — POSTs to `/api/chat` and parses SSE frames.
  - `useChatStream(): { messages: DisplayMessage[]; send: (text: string) => void; isStreaming: boolean }` where `DisplayMessage = { role: ChatRole; content: string; toolSteps: ToolStep[] }`.

- [ ] **Step 1: Implement `streamChat` (transport; covered indirectly by the hook test)**

`src/api/streamChat.ts`:

```ts
/** Browser fetch wrapper around POST /api/chat. Parses the SSE byte stream
 * and invokes onEvent for each decoded SseEvent. */
import type { ChatMessage, SseEvent } from '@/types/chat';

export async function streamChat(
  messages: ChatMessage[],
  onEvent: (event: SseEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Chat request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const line = frame.trim();
      if (!line.startsWith('data:')) continue;
      onEvent(JSON.parse(line.slice('data:'.length).trim()) as SseEvent);
    }
  }
}
```

- [ ] **Step 2: Write the failing hook test**

The test mocks `streamChat` to push a scripted event sequence and asserts the hook builds the right messages and tool steps.

`src/__tests__/state/useChatStream.test.tsx`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
  streamChat: vi.fn(async (_messages, onEvent) => {
    onEvent({ type: 'tool_call', name: 'search_wikipedia', input: { query: 'x' } });
    onEvent({ type: 'tool_result', name: 'search_wikipedia', summary: '3 result(s)' });
    onEvent({ type: 'text', delta: 'Hello ' });
    onEvent({ type: 'text', delta: 'world.' });
    onEvent({ type: 'done' });
  }),
}));

import { useChatStream } from '@/state/useChatStream';

describe('useChatStream', () => {
  afterEach(() => vi.clearAllMocks());

  it('accumulates the user message, tool steps, and streamed answer', async () => {
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.send('q'));

    await waitFor(() => expect(result.current.isStreaming).toBe(false));

    const [userMessage, assistantMessage] = result.current.messages;
    expect(userMessage).toMatchObject({ role: 'user', content: 'q' });
    expect(assistantMessage.role).toBe('assistant');
    expect(assistantMessage.content).toBe('Hello world.');
    expect(assistantMessage.toolSteps).toEqual([
      { name: 'search_wikipedia', input: { query: 'x' }, summary: '3 result(s)' },
    ]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/state/useChatStream.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `useChatStream`**

`src/state/useChatStream.ts`:

```ts
/** React hook that drives a chat conversation: sends history to /api/chat via
 * streamChat and accumulates streamed text and tool steps per assistant turn. */
'use client';

import { useCallback, useState } from 'react';
import { streamChat } from '@/api/streamChat';
import type { ChatMessage, ChatRole, ToolStep } from '@/types/chat';

export type DisplayMessage = {
  role: ChatRole;
  content: string;
  toolSteps: ToolStep[];
};

type UseChatStream = {
  messages: DisplayMessage[];
  send: (text: string) => void;
  isStreaming: boolean;
};

export function useChatStream(): UseChatStream {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) {
        return;
      }
      const userMessage: DisplayMessage = {
        role: 'user',
        content: text,
        toolSteps: [],
      };
      const history: ChatMessage[] = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { role: 'assistant', content: '', toolSteps: [] },
      ]);
      setIsStreaming(true);

      void runStream(history, setMessages).finally(() =>
        setIsStreaming(false),
      );
    },
    [isStreaming, messages],
  );

  return { messages, send, isStreaming };
}

async function runStream(
  history: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>,
): Promise<void> {
  await streamChat(history, (event) => {
    setMessages((prev) => applyEvent(prev, event));
  });
}

function applyEvent(
  messages: DisplayMessage[],
  event: import('@/types/chat').SseEvent,
): DisplayMessage[] {
  const next = [...messages];
  const last = next[next.length - 1];
  if (!last || last.role !== 'assistant') {
    return next;
  }
  if (event.type === 'text') {
    next[next.length - 1] = { ...last, content: last.content + event.delta };
  } else if (event.type === 'tool_call') {
    next[next.length - 1] = {
      ...last,
      toolSteps: [
        ...last.toolSteps,
        { name: event.name, input: event.input, summary: null },
      ],
    };
  } else if (event.type === 'tool_result') {
    next[next.length - 1] = {
      ...last,
      toolSteps: last.toolSteps.map((step, index) =>
        index === last.toolSteps.length - 1
          ? { ...step, summary: event.summary }
          : step,
      ),
    };
  } else if (event.type === 'error') {
    next[next.length - 1] = {
      ...last,
      content: last.content + `\n[error: ${event.message}]`,
    };
  }
  return next;
}
```

- [ ] **Step 5: Run test to verify it passes, then commit**

Run: `npx vitest run src/__tests__/state/useChatStream.test.tsx`
Expected: PASS (1 test).

```bash
git add src/api src/state src/__tests__/state
git commit -m "feat: add browser SSE client and useChatStream hook"
```

---

### Task 9: Chat UI components and page

**Files:**
- Create: `src/components/ToolStep/ToolStep.tsx`, `src/components/ToolStep/ToolStep.module.scss`
- Create: `src/components/Message/Message.tsx`, `src/components/Message/Message.module.scss`
- Create: `src/components/Chat/Chat.tsx`, `src/components/Chat/Chat.module.scss`
- Modify: `src/app/page.tsx`
- Test: `src/__tests__/components/Chat/Chat.test.tsx`

**Interfaces:**
- Consumes: `useChatStream`, `DisplayMessage`, `ToolStep` type.
- Produces: `<Chat/>`, `<Message message={DisplayMessage}/>`, `<ToolStep step={ToolStep}/>`.

- [ ] **Step 1: Implement `ToolStep` and `Message` (presentational)**

`src/components/ToolStep/ToolStep.tsx`:

```tsx
/** Renders one agent tool-use step: the tool name, its input, and a result
 * summary once available. */
import type { ToolStep as ToolStepData } from '@/types/chat';
import styles from './ToolStep.module.scss';

export function ToolStep({ step }: { step: ToolStepData }) {
  const label = describeInput(step.input);
  return (
    <div className={styles.step}>
      <span className={styles.name}>{step.name}</span>
      {label ? <span className={styles.input}>{label}</span> : null}
      <span className={styles.summary}>
        {step.summary ?? 'running...'}
      </span>
    </div>
  );
}

function describeInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const value = record.query ?? record.title;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}
```

`src/components/ToolStep/ToolStep.module.scss`:

```scss
.step {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-left: 2px solid #888;
  margin: 0.25rem 0;
}

.name {
  font-weight: 600;
}

.input {
  font-style: italic;
}

.summary {
  color: #666;
  margin-left: auto;
}
```

`src/components/Message/Message.tsx`:

```tsx
/** Renders a single chat message: tool steps (for assistant turns) followed
 * by the message text. */
import { ToolStep } from '@/components/ToolStep/ToolStep';
import type { DisplayMessage } from '@/state/useChatStream';
import styles from './Message.module.scss';

export function Message({ message }: { message: DisplayMessage }) {
  return (
    <div className={styles[message.role]}>
      {message.toolSteps.length > 0 ? (
        <div className={styles.steps}>
          {message.toolSteps.map((step, index) => (
            <ToolStep key={index} step={step} />
          ))}
        </div>
      ) : null}
      <p className={styles.text}>{message.content}</p>
    </div>
  );
}
```

`src/components/Message/Message.module.scss`:

```scss
.user,
.assistant {
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  border-radius: 0.5rem;
}

.user {
  background: #e8eef6;
}

.assistant {
  background: #f4f1ea;
}

.text {
  margin: 0;
  white-space: pre-wrap;
}

.steps {
  margin-bottom: 0.5rem;
}
```

- [ ] **Step 2: Write the failing `Chat` test**

`src/__tests__/components/Chat/Chat.test.tsx`:

```ts
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/streamChat', () => ({
  streamChat: vi.fn(async (_messages, onEvent) => {
    onEvent({ type: 'text', delta: 'Hello from the agent.' });
    onEvent({ type: 'done' });
  }),
}));

import { Chat } from '@/components/Chat/Chat';

describe('Chat', () => {
  afterEach(() => vi.clearAllMocks());

  it('sends input and renders the streamed answer', async () => {
    render(<Chat />);
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Tell me about Anthropic' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    expect(screen.getByText('Tell me about Anthropic')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Hello from the agent.')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/Chat/Chat.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement `Chat`**

`src/components/Chat/Chat.tsx`:

```tsx
/** The chat surface: message list plus a labelled input that sends to the
 * research agent and renders streamed answers and tool steps. */
'use client';

import { useState } from 'react';
import { Message } from '@/components/Message/Message';
import { useChatStream } from '@/state/useChatStream';
import styles from './Chat.module.scss';

export function Chat() {
  const { messages, send, isStreaming } = useChatStream();
  const [draft, setDraft] = useState('');

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    send(draft);
    setDraft('');
  }

  return (
    <main className={styles.chat}>
      <div className={styles.messages}>
        {messages.map((message, index) => (
          <Message key={index} message={message} />
        ))}
      </div>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label htmlFor="message" className={styles.label}>
          Message
        </label>
        <input
          id="message"
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask for an overview or a dossier..."
        />
        <button type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </main>
  );
}
```

`src/components/Chat/Chat.module.scss`:

```scss
.chat {
  max-width: 48rem;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.messages {
  flex: 1;
  overflow-y: auto;
}

.form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-top: 1rem;
}

.label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.input {
  flex: 1;
  padding: 0.5rem;
  font-size: 1rem;
}
```

- [ ] **Step 5: Wire the page and run the test**

`src/app/page.tsx`:

```tsx
import { Chat } from '@/components/Chat/Chat';

export default function HomePage() {
  return <Chat />;
}
```

Run: `npx vitest run src/__tests__/components/Chat/Chat.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/components src/app/page.tsx src/__tests__/components
git commit -m "feat: add chat UI components and wire the home page"
```

---

### Task 10: Eval harness (judge, runner, report)

**Files:**
- Create: `src/services/eval/scoreSchema.ts`, `src/prompts/judgePrompt.ts`, `src/services/eval/judgeResult.ts`, `src/services/eval/collectAgentRun.ts`, `src/services/eval/writeReport.ts`, `evals/runEval.ts`, `evals/dataset.jsonl`
- Create fixture: `src/__fixtures__/judgeResponse.json`
- Test: `src/__tests__/services/eval/judgeResult.test.ts`, `src/__tests__/services/eval/writeReport.test.ts`, `src/__tests__/services/eval/collectAgentRun.test.ts`

**Interfaces:**
- Produces:
  - `ScoreSchema` (Zod) and `Score` (matches `types/eval.ts`).
  - `JUDGE_PROMPT: string`.
  - `collectAgentRun(question, { client, deps }): Promise<EvalRunOutput>` — runs the agent with a collecting sink.
  - `judgeResult(item, run, client): Promise<Score>`.
  - `writeReport(results: EvalResult[]): { markdown: string; json: string }`.

- [ ] **Step 1: Create the Zod schema and judge prompt**

`src/services/eval/scoreSchema.ts`:

```ts
/** Zod schema for the LLM judge's structured score output. */
import { z } from 'zod';

export const ScoreSchema = z.object({
  factuality: z.number().min(1).max(10),
  citationUse: z.number().min(1).max(10),
  completeness: z.number().min(1).max(10),
  toolEfficiency: z.number().min(1).max(10),
  rationale: z.string(),
  pass: z.boolean(),
});
```

`src/prompts/judgePrompt.ts`:

```ts
/** System prompt for the eval judge. Asks for per-axis 1-10 scores grounded
 * in the rubric and reference facts. */
export const JUDGE_PROMPT = [
  'You are a strict evaluator of research assistant answers.',
  'Score the answer on four axes from 1 (poor) to 10 (excellent):',
  '- factuality: are claims correct and consistent with the reference facts?',
  '- citationUse: are sources (article titles, URLs) cited for key claims?',
  '- completeness: does it cover what the rubric asks?',
  '- toolEfficiency: did the tool trajectory look purposeful, not wasteful?',
  'Set pass=true only if factuality and completeness are both >= 7.',
  'Give a one or two sentence rationale. Be specific and critical.',
].join('\n');
```

- [ ] **Step 2: Write failing test for `judgeResult` using a captured judge fixture**

Create `src/__fixtures__/judgeResponse.json` (real-shaped `messages.parse` result; author this if no key):

```json
{
  "parsed_output": {
    "factuality": 8,
    "citationUse": 7,
    "completeness": 9,
    "toolEfficiency": 8,
    "rationale": "Accurate and well cited; minor gaps on dates.",
    "pass": true
  }
}
```

`src/__tests__/services/eval/judgeResult.test.ts`:

```ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it, vi } from 'vitest';
import { judgeResult } from '@/services/eval/judgeResult';
import type { EvalItem, EvalRunOutput } from '@/types/eval';

const fixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../../__fixtures__/judgeResponse.json'),
    'utf8',
  ),
);

const item: EvalItem = { id: 'q1', question: 'Q', rubric: 'cover X and Y' };
const run: EvalRunOutput = {
  finalAnswer: 'A',
  toolsUsed: ['search_wikipedia'],
  iterationCount: 2,
};

describe('judgeResult', () => {
  it('returns the parsed score from the judge model', async () => {
    const client = {
      messages: { parse: vi.fn(async () => fixture) },
    } as never;
    const score = await judgeResult(item, run, client);
    expect(score.factuality).toBe(8);
    expect(score.pass).toBe(true);
  });

  it('validates the score against the schema (rejects out-of-range)', async () => {
    const bad = { parsed_output: { ...fixture.parsed_output, factuality: 99 } };
    const client = {
      messages: { parse: vi.fn(async () => bad) },
    } as never;
    await expect(judgeResult(item, run, client)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails, then implement `judgeResult`**

Run: `npx vitest run src/__tests__/services/eval/judgeResult.test.ts`
Expected: FAIL (module not found).

`src/services/eval/judgeResult.ts`:

```ts
/** Scores one agent run against its rubric using the judge model with a
 * structured (Zod) output format, then re-validates the result. */
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { JUDGE_MODEL, MAX_TOKENS } from '@/constants/models';
import { JUDGE_PROMPT } from '@/prompts/judgePrompt';
import { ScoreSchema } from '@/services/eval/scoreSchema';
import type { EvalItem, EvalRunOutput, Score } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

export async function judgeResult(
  item: EvalItem,
  run: EvalRunOutput,
  client: Anthropic,
): Promise<Score> {
  const userContent = [
    `Question: ${item.question}`,
    `Rubric: ${item.rubric}`,
    item.referenceFacts
      ? `Reference facts:\n- ${item.referenceFacts.join('\n- ')}`
      : 'Reference facts: none provided',
    `Tools used: ${run.toolsUsed.join(', ') || 'none'}`,
    `Answer:\n${run.finalAnswer}`,
  ].join('\n\n');

  const response = await client.messages.parse({
    model: JUDGE_MODEL,
    max_tokens: MAX_TOKENS,
    system: JUDGE_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    output_config: { format: zodOutputFormat(ScoreSchema) },
  } as Anthropic.MessageCreateParamsNonStreaming);

  return ScoreSchema.parse(
    (response as { parsed_output: unknown }).parsed_output,
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/judgeResult.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write failing test for `collectAgentRun`**

`src/__tests__/services/eval/collectAgentRun.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/agent/runResearchAgent', () => ({
  runResearchAgent: vi.fn(async (_messages, { sink }) => {
    sink.onToolCall('search_wikipedia', { query: 'x' });
    sink.onToolResult('search_wikipedia', '3 result(s)');
    sink.onText('Partial ');
    sink.onDone('Final answer.');
  }),
}));

import { collectAgentRun } from '@/services/eval/collectAgentRun';

describe('collectAgentRun', () => {
  afterEach(() => vi.clearAllMocks());

  it('collects the final answer and the tools used', async () => {
    const run = await collectAgentRun('What is X?', {
      client: {} as never,
      deps: { tavilyApiKey: 't' },
    });
    expect(run.finalAnswer).toBe('Final answer.');
    expect(run.toolsUsed).toEqual(['search_wikipedia']);
    expect(run.iterationCount).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails, then implement `collectAgentRun`**

Run: `npx vitest run src/__tests__/services/eval/collectAgentRun.test.ts`
Expected: FAIL (module not found).

`src/services/eval/collectAgentRun.ts`:

```ts
/** Runs the research agent for one question with a collecting sink, returning
 * the final answer and the tool trajectory for the judge. */
import { runResearchAgent } from '@/services/agent/runResearchAgent';
import type { AgentSink } from '@/services/agent/agentSink';
import type { ToolDeps } from '@/tools/agentTool';
import type { EvalRunOutput } from '@/types/eval';
import type Anthropic from '@anthropic-ai/sdk';

type CollectOptions = { client: Anthropic; deps: ToolDeps };

export async function collectAgentRun(
  question: string,
  { client, deps }: CollectOptions,
): Promise<EvalRunOutput> {
  const toolsUsed: string[] = [];
  let finalAnswer = '';
  let iterationCount = 0;

  const sink: AgentSink = {
    onThinking: () => {},
    onText: (delta) => {
      finalAnswer += delta;
    },
    onToolCall: (name) => {
      toolsUsed.push(name);
      iterationCount += 1;
    },
    onToolResult: () => {},
    onDone: (text) => {
      finalAnswer = text;
    },
    onError: (message) => {
      finalAnswer = finalAnswer || `[error: ${message}]`;
    },
  };

  await runResearchAgent([{ role: 'user', content: question }], {
    client,
    sink,
    deps,
  });

  return { finalAnswer, toolsUsed, iterationCount: Math.max(iterationCount, 1) };
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/collectAgentRun.test.ts`
Expected: PASS (1 test).

- [ ] **Step 8: Write failing test for `writeReport`**

`src/__tests__/services/eval/writeReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { writeReport } from '@/services/eval/writeReport';
import type { EvalResult } from '@/types/eval';

const results: EvalResult[] = [
  {
    item: { id: 'q1', question: 'Q1', rubric: 'r' },
    run: { finalAnswer: 'a', toolsUsed: ['search_wikipedia'], iterationCount: 1 },
    score: {
      factuality: 8,
      citationUse: 8,
      completeness: 8,
      toolEfficiency: 8,
      rationale: 'good',
      pass: true,
    },
  },
  {
    item: { id: 'q2', question: 'Q2', rubric: 'r' },
    run: { finalAnswer: 'b', toolsUsed: [], iterationCount: 1 },
    score: {
      factuality: 4,
      citationUse: 4,
      completeness: 4,
      toolEfficiency: 6,
      rationale: 'thin',
      pass: false,
    },
  },
];

describe('writeReport', () => {
  it('computes pass count and per-axis averages in the markdown', () => {
    const { markdown } = writeReport(results);
    expect(markdown).toContain('1/2 passed');
    expect(markdown).toContain('factuality');
    expect(markdown).toContain('6.0'); // (8 + 4) / 2
  });

  it('emits valid JSON of the full results', () => {
    const { json } = writeReport(results);
    expect(JSON.parse(json)).toHaveLength(2);
  });
});
```

- [ ] **Step 9: Run test to verify it fails, then implement `writeReport`**

Run: `npx vitest run src/__tests__/services/eval/writeReport.test.ts`
Expected: FAIL (module not found).

`src/services/eval/writeReport.ts`:

```ts
/** Builds the human-readable markdown report and the full JSON dump from a
 * set of eval results. Returns strings; the runner writes them to disk. */
import type { EvalResult, Score } from '@/types/eval';

const AXES: (keyof Score)[] = [
  'factuality',
  'citationUse',
  'completeness',
  'toolEfficiency',
];

export function writeReport(results: EvalResult[]): {
  markdown: string;
  json: string;
} {
  const passCount = results.filter((r) => r.score.pass).length;
  const averages = AXES.map(
    (axis) => `${axis}: ${average(results, axis).toFixed(1)}`,
  );

  const rows = results.map(
    (r) =>
      `| ${r.item.id} | ${r.score.factuality} | ${r.score.citationUse} | ` +
      `${r.score.completeness} | ${r.score.toolEfficiency} | ` +
      `${r.score.pass ? 'PASS' : 'FAIL'} | ${r.score.rationale} |`,
  );

  const markdown = [
    '# Eval Report',
    '',
    '> Scores are produced by an LLM judge and are directional, not exact.',
    '',
    `**${passCount}/${results.length} passed**`,
    '',
    `Averages: ${averages.join(', ')}`,
    '',
    '| id | fact | cite | compl | toolEff | result | rationale |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');

  return { markdown, json: JSON.stringify(results, null, 2) };
}

function average(results: EvalResult[], axis: keyof Score): number {
  if (results.length === 0) {
    return 0;
  }
  const total = results.reduce((sum, r) => sum + Number(r.score[axis]), 0);
  return total / results.length;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run src/__tests__/services/eval/writeReport.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 11: Create the seed dataset and the runner script**

`evals/dataset.jsonl` (one JSON object per line; ship ~12-15, three shown here):

```
{"id":"nanking","question":"Give me a high-level overview of the Rape of Nanking.","rubric":"Covers what happened, when (1937-1938), where (Nanjing), who (Imperial Japanese Army), and scale; cites Wikipedia.","referenceFacts":["Occurred in Nanjing in 1937-1938","Perpetrated by the Imperial Japanese Army during the Second Sino-Japanese War"]}
{"id":"anthropic","question":"Build a short dossier on the company Anthropic.","rubric":"Covers founding year, founders, what the company does, and a notable product; cites sources.","referenceFacts":["Founded in 2021","Develops the Claude family of AI models"]}
{"id":"photosynthesis","question":"Explain photosynthesis at a high level.","rubric":"Covers inputs (light, water, CO2), outputs (glucose, oxygen), and where it happens (chloroplasts).","referenceFacts":["Converts light energy into chemical energy","Produces oxygen as a byproduct"]}
```

`evals/runEval.ts`:

```ts
/** Offline eval entry point: loads the dataset, runs the agent per question,
 * judges each result, and writes report.md and report.json. */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { createAnthropicClient } from '../src/clients/anthropic/createAnthropicClient';
import { loadServerConfig } from '../src/config/loadServerConfig';
import { collectAgentRun } from '../src/services/eval/collectAgentRun';
import { judgeResult } from '../src/services/eval/judgeResult';
import { writeReport } from '../src/services/eval/writeReport';
import type { EvalItem, EvalResult } from '../src/types/eval';

async function main(): Promise<void> {
  const { anthropicApiKey, tavilyApiKey } = loadServerConfig();
  const client = createAnthropicClient(anthropicApiKey);
  const deps = { tavilyApiKey };
  const items = loadDataset();

  const results: EvalResult[] = [];
  for (const item of items) {
    process.stdout.write(`Running ${item.id}...\n`);
    const run = await collectAgentRun(item.question, { client, deps });
    const score = await judgeResult(item, run, client);
    results.push({ item, run, score });
  }

  const { markdown, json } = writeReport(results);
  const outDir = resolve(import.meta.dirname, 'reports');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'report.md'), markdown);
  writeFileSync(resolve(outDir, 'report.json'), json);
  process.stdout.write(`Wrote ${results.length} results to ${outDir}\n`);
}

function loadDataset(): EvalItem[] {
  const path = resolve(import.meta.dirname, 'dataset.jsonl');
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as EvalItem);
}

void main();
```

- [ ] **Step 12: Run the full eval test suite and commit**

Run: `npx vitest run src/__tests__/services/eval`
Expected: PASS (5 tests across 3 files).

```bash
git add src/services/eval src/prompts/judgePrompt.ts evals src/__fixtures__/judgeResponse.json src/__tests__/services/eval
git commit -m "feat: add eval harness (judge, collector, report, runner, dataset)"
```

---

### Task 11: README, env example, full-suite gate

**Files:**
- Create: `README.md`
- Verify: full test suite, lint, build.

- [ ] **Step 1: Write `README.md`**

```markdown
# Research Chatbot (educational MVP)

A streaming, tool-using research chatbot with an offline LLM-judge eval harness.
Built to demonstrate a modern agent loop with measurable quality.

## What it does

Ask for an overview or a dossier ("overview of the Rape of Nanking", "dossier on
Anthropic"). The agent calls Wikipedia and web-search tools, shows each step
live, and writes a cited synthesis.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `ANTHROPIC_API_KEY` and
   `TAVILY_API_KEY`.
3. `npm run dev` and open http://localhost:3000

## Architecture

- `src/services/agent/runResearchAgent.ts` - the tool-use loop. Emits events to
  an `AgentSink`; the chat route supplies an SSE sink, the eval harness a
  collecting sink, so both exercise the same agent.
- `src/tools/` - the four custom tools (schema + execute).
- `src/clients/` - thin provider wrappers (Wikipedia REST, Tavily, Anthropic).
- `src/services/eval/` - the offline judge harness.

## Models

`src/constants/models.ts` sets `AGENT_MODEL` and `JUDGE_MODEL` (both
`claude-opus-4-8`). Switch `AGENT_MODEL` to `claude-sonnet-4-6` to cut eval cost.

## Evals

`npm run eval` runs the agent over `evals/dataset.jsonl`, judges each answer, and
writes `evals/reports/report.md` and `report.json`. Scores come from an LLM judge
and are directional, not exact.

## Tests

`npm test` runs the Vitest suite (unit, client fixtures, agent loop, route, hook,
components, eval). No live API calls in tests.
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (all tests green; ~30 tests).

- [ ] **Step 3: Run lint and typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: no errors. Fix any lint issues (e.g. import order) before committing.

- [ ] **Step 4: Build smoke**

Run: `npm run build`
Expected: Next build succeeds.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README and project overview"
```

---

## Self-review notes

- Spec coverage: agent loop (Task 6), four tools (Task 5), Wikipedia + Tavily
  clients (Tasks 3-4), SSE contract (Tasks 6-7), streaming UI with visible tool
  steps (Tasks 8-9), offline judge harness with rubric + report (Task 10),
  ephemeral no-DB design (no persistence anywhere), AgentSink with
  future-generator TODO (Task 6), Opus 4.8 both models (Task 1 constants), copied
  Doppelscript configs (Task 1). All present.
- The `as Anthropic...` casts on the two model calls are intentional: the SDK's
  published types may lag `output_config`/`thinking`/`parsed_output`; the runtime
  shapes are correct per the Anthropic API. Do not strip the parameters to satisfy
  the type checker; cast instead.
- Negative-input tests exist per tool (Task 5) per R-208.
- Out of scope, by design: Playwright E2E, persistence, deploy.
