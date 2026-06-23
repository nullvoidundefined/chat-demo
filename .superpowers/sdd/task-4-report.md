# Task 4 Report: Tavily Web-Search Client + Fixture Test

## TDD Evidence

### RED (Module Not Found)
```
Error: Failed to resolve import "@/clients/tavily/searchWeb" from test
```
Test run confirmed failure before implementation.

### GREEN (All Tests Pass)
```
✓ src/__tests__/clients/tavily/searchWeb.test.ts (2 tests) 4ms
Test Files  1 passed (1)
Tests  2 passed (2)
```

## Files Changed
- `src/clients/tavily/searchWeb.ts`: Main implementation (30 lines)
- `src/__tests__/clients/tavily/searchWeb.test.ts`: Test suite with fixture-based assertions
- `src/__fixtures__/tavilySearch.json`: Real-shaped Tavily API response

## Implementation Review

### Real-Behavior Assertions (Not Mock-Only)
1. **Test 1: "maps Tavily results to title/url/snippet"**
   - Asserts actual transformation: `content` to `snippet`
   - Verifies `title` and `url` preserved from fixture
   - Validates the mapped shape matches `WebResult` type

2. **Test 2: "sends the api key and query in the POST body"**
   - Captures POST body and asserts `api_key` and `query` fields
   - Verifies request shape to Tavily API matches contract
   - Both assertions validate behavior, not mock call counts

### Implementation Details
- **File-level header**: Present (`/** */` block) explaining function purpose and design choice (API key passed in, not read from env)
- **Error handling**: Throws on `!response.ok` with descriptive message including status code
- **Type safety**:
  - Input: `(query: string, apiKey: string, maxResults = 5)`
  - Output: `Promise<WebResult[]>` with shape `{title, url, snippet}`
  - Internal API response type safely cast with `as` and nullish-coalesced to `[]`
- **API key handling**: Passed as function argument (from server config), never read from env
- **Default parameter**: `maxResults = 5` matches brief spec
- **Mapping logic**: Transforms Tavily's `content` field to `snippet` for consumer-friendly API

### Code Quality
- Follows R-230 (file-level header)
- Follows R-235 (one exported function per file)
- Follows R-227 (atomic function, no inline logic beyond fetch/map)
- Follows R-232 (verb-noun naming: `searchWeb`)
- No mock-self anti-pattern; test fixture is real-shaped and isolated

## Concerns
None. All requirements met; test-first approach confirmed behavior before ship.

## Fix: tsc strict mock typing

### `npx tsc --noEmit`
```
(no output)
Exit code: 0 - clean
```

### `npx vitest run src/__tests__/clients/tavily/searchWeb.test.ts`
```
✓ src/__tests__/clients/tavily/searchWeb.test.ts (2 tests) 4ms
Test Files  1 passed (1)
Tests  2 passed (2)
```

Typed mock parameters `(_url: string, _init?: RequestInit)` and guarded tuple indexing with optional chaining (`?.[]`) to satisfy TypeScript strict mode. Both assertions (api_key and query in POST body) preserved.
