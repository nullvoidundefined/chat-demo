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

